// mttcsr.com — Content Tool server (adapted from the WOA Studio content tool)
// Writes src/content/works/<slug>.md and media into src/assets/works/<slug>/.
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import matter from 'gray-matter';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir   = path.join(__dirname, '..');

const CONTENT_DIR     = path.join(rootDir, 'src', 'content', 'works');
const MEDIA_DIR       = path.join(rootDir, 'src', 'assets', 'works');
const TMP_DIR         = path.join(__dirname, '.tmp');
const SOURCES_DIR     = path.join(TMP_DIR, 'sources');
const TEMP_UPLOAD_DIR = path.join(TMP_DIR, 'uploads');
const PROXY_DIR       = path.join(TMP_DIR, 'proxies');
const NODE_MODULES    = path.join(rootDir, 'node_modules');

const PORT = Number(process.env.CONTENT_TOOL_PORT) || 3030;

// Video encoding defaults (same as the WOA tool)
const VIDEO_HEIGHT   = 720;
const VIDEO_BITRATE  = '1.5M';
const VIDEO_MAXRATE  = '3M';
const VIDEO_BUFSIZE  = '5M';
const VIDEO_FPS      = 25;
const PROXY_HEIGHT   = 480;
const PROXY_BITRATE  = '500k';

const SLUG_RE      = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const YEARMONTH_RE = /^\d{4}-\d{2}$/;

const app = express();
app.use(express.static(__dirname, { dotfiles: 'ignore' }));
app.use('/media', express.static(MEDIA_DIR));
app.use('/tmp-media', express.static(PROXY_DIR));
app.get('/vendor/sortable.min.js', (_req, res) => res.sendFile(path.join(NODE_MODULES, 'sortablejs', 'Sortable.min.js')));
app.get('/vendor/heic2any.min.js', (_req, res) => res.sendFile(path.join(NODE_MODULES, 'heic2any', 'dist', 'heic2any.min.js')));
app.use(express.json({ limit: '5mb' }));

const upload = multer({ dest: TEMP_UPLOAD_DIR });

// ── Directories ───────────────────────────────────────────────────────────────
const ensureDir = (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };
const wipeDir   = (d) => { if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true }); };

console.log('Pulizia cartelle temporanee...');
wipeDir(TMP_DIR);
[TEMP_UPLOAD_DIR, SOURCES_DIR, PROXY_DIR, CONTENT_DIR, MEDIA_DIR].forEach(ensureDir);

const assertSlug = (slug) => {
  if (!SLUG_RE.test(slug || '')) throw new Error(`Slug non valido: "${slug}" (solo a-z, 0-9 e trattini)`);
  return slug;
};
const mdPathFor    = (slug) => path.join(CONTENT_DIR, `${assertSlug(slug)}.md`);
const mediaDirFor  = (slug) => path.join(MEDIA_DIR, assertSlug(slug));
const safeBasename = (name) => path.basename(String(name || ''));

// ── State: sources + jobs (in memory, reset on restart) ───────────────────────
const sources = new Map(); // id -> { id, name, path, proxyPath, thumbPath, duration }
const jobs    = new Map(); // id -> { status, currentStep, totalSteps, sseClients, command, result, error, aborted }

const newId = () => crypto.randomBytes(8).toString('hex');

// ── FFmpeg helpers ────────────────────────────────────────────────────────────
const probeDuration = (filePath) => new Promise((resolve) => {
  ffmpeg.ffprobe(filePath, (err, data) => {
    if (err || !data?.format?.duration) return resolve(null);
    resolve(Number(data.format.duration));
  });
});

const extractThumb = (input, output) => new Promise((resolve, reject) => {
  ffmpeg(input)
    .outputOptions(['-vframes 1', '-q:v 4'])
    .save(output)
    .on('end', () => resolve(output))
    .on('error', reject);
});

const buildProxy = (input, output, onProgress) => new Promise((resolve, reject) => {
  ffmpeg(input)
    .size(`?x${PROXY_HEIGHT}`)
    .outputOptions(['-vcodec libvpx-vp9', '-deadline realtime', '-cpu-used 5', `-b:v ${PROXY_BITRATE}`, '-an'])
    .save(output)
    .on('progress', (p) => onProgress?.(p))
    .on('end', () => resolve(output))
    .on('error', reject);
});

const encodeClip = (job, inputPath, outputPath, opts = {}) => {
  const { start, end, bitrate = VIDEO_BITRATE, maxrate = VIDEO_MAXRATE, fps = VIDEO_FPS } = opts;
  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(inputPath);
    if (start && start > 0) cmd = cmd.setStartTime(start);
    if (end && end > 0) {
      const duration = end - (start || 0);
      if (duration > 0) cmd = cmd.setDuration(duration);
    }
    cmd
      .size(`?x${VIDEO_HEIGHT}`)
      .fps(fps || VIDEO_FPS)
      .outputOptions([
        '-vcodec libvpx-vp9',
        `-b:v ${bitrate || VIDEO_BITRATE}`,
        `-maxrate ${maxrate || VIDEO_MAXRATE}`,
        `-bufsize ${VIDEO_BUFSIZE}`,
        '-deadline good',
        '-cpu-used 4',
        '-an',
        '-row-mt 1',
      ])
      .save(outputPath)
      .on('start', () => { job.command = cmd; })
      .on('progress', (p) => {
        job.percent = Math.min(99, Math.round(p.percent || 0));
        broadcastProgress(job);
      })
      .on('end', () => { job.command = null; resolve(outputPath); })
      .on('error', (err) => {
        job.command = null;
        reject(job.aborted ? new Error('ABORTED') : err);
      });
  });
};

// ── Jobs / SSE ────────────────────────────────────────────────────────────────
const createJob = (totalSteps) => {
  const job = {
    id: newId(), status: 'pending', currentStep: 0, totalSteps,
    sseClients: new Set(), command: null, result: null, error: null, aborted: false,
  };
  jobs.set(job.id, job);
  return job;
};

const broadcast = (job, event, data) => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of job.sseClients) {
    try { client.write(payload); } catch { /* client gone */ }
  }
};

const progressPayload = (job) => ({
  status: job.status, currentStep: job.currentStep, totalSteps: job.totalSteps,
  currentName: job.currentName || '', percent: job.percent || 0,
});
const broadcastProgress = (job) => broadcast(job, 'progress', progressPayload(job));
const jobUpdate = (job, partial) => { Object.assign(job, partial); broadcastProgress(job); };

app.get('/api/job/:jobId/events', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  job.sseClients.add(res);
  res.write(`event: progress\ndata: ${JSON.stringify(progressPayload(job))}\n\n`);
  if (job.status === 'done')    res.write(`event: done\ndata: ${JSON.stringify(job.result)}\n\n`);
  if (job.status === 'error')   res.write(`event: error\ndata: ${JSON.stringify({ error: job.error })}\n\n`);
  if (job.status === 'aborted') res.write('event: aborted\ndata: {}\n\n');

  req.on('close', () => { job.sseClients.delete(res); });
});

app.post('/api/job/:jobId/abort', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job non trovato' });
  if (['done', 'error', 'aborted'].includes(job.status)) return res.json({ success: true, status: job.status });
  job.aborted = true;
  try { job.command?.kill?.('SIGKILL'); } catch { /* already stopped */ }
  res.json({ success: true });
});

// ── Source library (video originals → clips) ──────────────────────────────────
app.post('/api/source/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) throw new Error('Nessun video caricato');
    const id        = newId();
    const cleanName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const srcPath   = path.join(SOURCES_DIR, `${id}-${cleanName}`);
    fs.renameSync(req.file.path, srcPath);

    const proxyPath = path.join(PROXY_DIR, `${id}.webm`);
    const thumbPath = path.join(PROXY_DIR, `${id}.jpg`);
    const duration  = await probeDuration(srcPath);

    const job = createJob(1);
    res.json({ jobId: job.id, id, name: cleanName, duration });

    try {
      jobUpdate(job, { status: 'running', currentStep: 1, currentName: `Generazione proxy: ${cleanName}`, percent: 0 });
      await buildProxy(srcPath, proxyPath, (p) => {
        job.percent = Math.min(99, Math.round(p.percent || 0));
        broadcastProgress(job);
      });
      try { await extractThumb(srcPath, thumbPath); } catch (e) { console.warn('thumb sorgente fallita:', e.message); }

      sources.set(id, { id, name: cleanName, path: srcPath, proxyPath, thumbPath, duration });
      const sourceData = {
        id, name: cleanName, duration,
        proxyUrl: `/tmp-media/${id}.webm`,
        thumbUrl: fs.existsSync(thumbPath) ? `/tmp-media/${id}.jpg` : null,
      };
      job.result = sourceData;
      jobUpdate(job, { status: 'done', percent: 100 });
      broadcast(job, 'done', sourceData);
    } catch (err) {
      console.error('source proxy error:', err);
      jobUpdate(job, { status: 'error', error: err.message });
      broadcast(job, 'error', { error: err.message });
    }
  } catch (err) {
    console.error('source/upload error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

app.delete('/api/source/:id', (req, res) => {
  const src = sources.get(req.params.id);
  if (!src) return res.status(404).json({ error: 'Sorgente non trovata' });
  try {
    [src.path, src.proxyPath, src.thumbPath].forEach((p) => { if (p && fs.existsSync(p)) fs.unlinkSync(p); });
    sources.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sources', (_req, res) => {
  res.json([...sources.values()].map((s) => ({
    id: s.id, name: s.name, duration: s.duration,
    proxyUrl: `/tmp-media/${s.id}.webm`,
    thumbUrl: fs.existsSync(s.thumbPath) ? `/tmp-media/${s.id}.jpg` : null,
  })));
});

// ── Works: read ───────────────────────────────────────────────────────────────
const thumbFor = (slug, filename, type) => {
  if (!filename) return null;
  if (type !== 'video') return filename;
  const thumb = filename.replace(/\.[^.]+$/, '.thumb.jpg');
  return fs.existsSync(path.join(MEDIA_DIR, slug, thumb)) ? thumb : null;
};

const listWorks = () => fs.readdirSync(CONTENT_DIR)
  .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
  .map((file) => {
    const slug = file.replace(/\.md$/, '');
    const { data } = matter(fs.readFileSync(path.join(CONTENT_DIR, file), 'utf-8'));
    const cardFile = data.cover || data.hero;
    const cardType = data.cover ? (data.coverType || 'image') : (data.heroType || 'image');
    return {
      slug,
      title: data.title || slug,
      subtitle: data.subtitle || '',
      yearMonth: data.yearMonth || '',
      thumb: thumbFor(slug, cardFile, cardType),
      isVideo: cardType === 'video',
      published: data.published !== false,
    };
  })
  .sort((a, b) => b.yearMonth.localeCompare(a.yearMonth) || a.title.localeCompare(b.title));

app.get('/api/works', (_req, res) => {
  try { res.json(listWorks()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/works/:slug', (req, res) => {
  try {
    const filePath = mdPathFor(req.params.slug);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Progetto non trovato' });
    const { data } = matter(fs.readFileSync(filePath, 'utf-8'));
    res.json({ frontmatter: data });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── Works: save (async job) ───────────────────────────────────────────────────
const cleanText = (v) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim() : '');

app.post('/api/save', upload.any(), async (req, res) => {
  const files = req.files || [];
  try {
    const body = req.body;
    const slug = assertSlug(cleanText(body.slug));
    const originalSlug = body.originalSlug ? assertSlug(cleanText(body.originalSlug)) : null;
    const title = cleanText(body.title);
    if (!title) throw new Error('Titolo obbligatorio');
    const yearMonth = cleanText(body.yearMonth);
    if (yearMonth && !YEARMONTH_RE.test(yearMonth)) throw new Error('Data non valida (formato YYYY-MM)');
    if (!originalSlug && fs.existsSync(mdPathFor(slug))) throw new Error(`Esiste già un progetto con slug "${slug}"`);
    if (originalSlug && originalSlug !== slug && fs.existsSync(mdPathFor(slug))) throw new Error(`Esiste già un progetto con slug "${slug}"`);

    const heroDef    = JSON.parse(body.heroDef || 'null');
    if (!heroDef) throw new Error('Hero obbligatorio');
    const useCover   = body.useCustomCover === 'true';
    const coverDef   = useCover && body.coverDef ? JSON.parse(body.coverDef) : null;
    const galleryMap = JSON.parse(body.galleryMap || '[]');
    const tags       = JSON.parse(body.tags || '[]').map(cleanText).filter(Boolean);

    const isEncodeStep = (def) => def && def.kind === 'clip';
    const totalSteps = Math.max(1, [heroDef, coverDef, ...galleryMap].filter(isEncodeStep).length);

    const job = createJob(totalSteps);
    res.json({ jobId: job.id });

    const fields = {
      title,
      subtitle: cleanText(body.subtitle),
      yearMonth,
      text: cleanText(body.text),
      context: cleanText(body.context),
      award: cleanText(body.award),
      role: cleanText(body.role),
      tags,
      published: body.published === 'true',
    };

    runSaveJob(job, { slug, originalSlug, fields, heroDef, coverDef, galleryMap, files })
      .catch((err) => {
        if (err?.message === 'ABORTED') {
          jobUpdate(job, { status: 'aborted' });
          broadcast(job, 'aborted', {});
        } else {
          console.error('save job error:', err);
          jobUpdate(job, { status: 'error', error: err.message });
          broadcast(job, 'error', { error: err.message });
        }
      })
      .finally(() => cleanupUploads(files));
  } catch (err) {
    console.error('save parse error:', err);
    cleanupUploads(files);
    if (!res.headersSent) res.status(400).json({ error: err.message });
  }
});

const cleanupUploads = (files) => {
  for (const f of files) {
    if (fs.existsSync(f.path)) {
      try { fs.unlinkSync(f.path); } catch { /* ignore */ }
    }
  }
};

async function runSaveJob(job, { slug, originalSlug, fields, heroDef, coverDef, galleryMap, files }) {
  const currentDir = mediaDirFor(originalSlug || slug);
  const targetDir  = mediaDirFor(slug);
  // Build the new media folder aside; swap it in only when everything succeeded.
  const stagingDir = path.join(TMP_DIR, `staging-${slug}-${Date.now()}`);
  fs.mkdirSync(stagingDir, { recursive: true });

  // Same clip on several slots → encode once, copy afterwards
  const encodedClips = new Map();

  jobUpdate(job, { status: 'running' });

  // Resolves one media definition into a file inside stagingDir.
  //  existing     → copy from the current media folder
  //  upload-image → rename the uploaded WebP (converted in the browser)
  //  clip         → encode a segment of a source video
  async function resolveItem(def, basename) {
    if (!def) return null;
    if (job.aborted) throw new Error('ABORTED');
    const isVideo   = def.type === 'video';
    const finalName = `${basename}.${isVideo ? 'webm' : 'webp'}`;
    const finalPath = path.join(stagingDir, finalName);
    const thumbPath = path.join(stagingDir, `${basename}.thumb.jpg`);

    if (def.kind === 'existing') {
      const src = safeBasename(def.src);
      const oldPath = path.join(currentDir, src);
      if (!fs.existsSync(oldPath)) throw new Error(`File esistente non trovato: ${src}`);
      const ext = path.extname(src);
      const keptName = `${basename}${ext}`;
      fs.copyFileSync(oldPath, path.join(stagingDir, keptName));
      if (isVideo) {
        const oldThumb = path.join(currentDir, src.replace(/\.[^.]+$/, '.thumb.jpg'));
        if (fs.existsSync(oldThumb)) fs.copyFileSync(oldThumb, thumbPath);
      }
      return { name: keptName, type: def.type };
    }

    if (def.kind === 'upload-image') {
      const file = files.find((f) => f.fieldname === def.fileId);
      if (!file) throw new Error(`Upload mancante per ${basename}`);
      fs.renameSync(file.path, finalPath);
      return { name: finalName, type: 'image' };
    }

    if (def.kind === 'clip') {
      const src = sources.get(def.sourceId);
      if (!src) throw new Error(`Sorgente ${def.sourceId} non disponibile (server riavviato?)`);
      const params = def.params || {};
      const key = [def.sourceId, params.start ?? '', params.end ?? '', params.bitrate, params.maxrate, params.fps].join('|');
      if (encodedClips.has(key)) {
        const cached = encodedClips.get(key);
        fs.copyFileSync(cached.videoPath, finalPath);
        if (fs.existsSync(cached.thumbPath)) fs.copyFileSync(cached.thumbPath, thumbPath);
        return { name: finalName, type: 'video' };
      }
      job.currentStep += 1;
      jobUpdate(job, { currentName: `${basename} (clip da ${src.name})`, percent: 0 });
      await encodeClip(job, src.path, finalPath, params);
      try { await extractThumb(finalPath, thumbPath); } catch (e) { console.warn('thumb fallita per', finalPath, e.message); }
      encodedClips.set(key, { videoPath: finalPath, thumbPath });
      return { name: finalName, type: 'video' };
    }

    throw new Error(`Tipo di media sconosciuto: ${def.kind}`);
  }

  try {
    const hero  = await resolveItem(heroDef, 'hero');
    const cover = coverDef ? await resolveItem(coverDef, 'cover') : null;
    const gallery = [];
    for (let i = 0; i < galleryMap.length; i++) {
      const item = await resolveItem(galleryMap[i], `gallery-${i + 1}`);
      if (item) gallery.push({ src: item.name, type: item.type });
    }
    if (job.aborted) throw new Error('ABORTED');

    // Swap media folder (old one kept as backup until the swap succeeds), then write markdown
    const backupDir = path.join(TMP_DIR, `backup-${originalSlug || slug}-${Date.now()}`);
    const hadCurrent = fs.existsSync(currentDir);
    if (hadCurrent) fs.renameSync(currentDir, backupDir);
    try {
      if (fs.existsSync(targetDir)) throw new Error(`La cartella media di "${slug}" esiste già`);
      fs.renameSync(stagingDir, targetDir);
    } catch (err) {
      if (hadCurrent) fs.renameSync(backupDir, currentDir);
      throw err;
    }
    if (hadCurrent) fs.rmSync(backupDir, { recursive: true, force: true });

    const data = {
      title: fields.title,
      subtitle: fields.subtitle || undefined,
      hero: hero.name,
      heroType: hero.type,
      cover: cover?.name,
      coverType: cover?.type,
      yearMonth: fields.yearMonth || undefined,
      text: fields.text || undefined,
      context: fields.context || undefined,
      award: fields.award || undefined,
      role: fields.role || undefined,
      tags: fields.tags.length ? fields.tags : undefined,
      gallery: gallery.length ? gallery : undefined,
      published: fields.published,
    };
    Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

    if (originalSlug && originalSlug !== slug && fs.existsSync(mdPathFor(originalSlug))) {
      fs.unlinkSync(mdPathFor(originalSlug));
    }
    fs.writeFileSync(mdPathFor(slug), matter.stringify('', data));
    console.log(`Salvato: ${slug}`);

    job.percent = 100;
    job.result  = { success: true, slug };
    jobUpdate(job, { status: 'done' });
    broadcast(job, 'done', job.result);
  } catch (err) {
    if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
    throw err;
  }
}

// ── Works: publish toggle / delete ────────────────────────────────────────────
app.patch('/api/published/:slug', (req, res) => {
  try {
    const { published } = req.body || {};
    if (typeof published !== 'boolean') return res.status(400).json({ error: 'published deve essere boolean' });
    const filePath = mdPathFor(req.params.slug);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Progetto non trovato' });
    const parsed = matter(fs.readFileSync(filePath, 'utf-8'));
    parsed.data.published = published;
    fs.writeFileSync(filePath, matter.stringify(parsed.content, parsed.data));
    res.json({ success: true, published });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/works/:slug', (req, res) => {
  try {
    const mdPath   = mdPathFor(req.params.slug);
    const mediaDir = mediaDirFor(req.params.slug);
    if (!fs.existsSync(mdPath)) return res.status(404).json({ error: 'Progetto non trovato' });
    fs.unlinkSync(mdPath);
    if (fs.existsSync(mediaDir)) fs.rmSync(mediaDir, { recursive: true, force: true });
    console.log(`Eliminato: ${req.params.slug}`);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/ping', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log('=========================================');
  console.log('mttcsr Content Tool avviato');
  console.log(`Apri http://localhost:${PORT}/tool.html`);
  console.log('=========================================');
});

process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason);
});
