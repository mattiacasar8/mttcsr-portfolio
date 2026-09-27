// ════════════════════════════════════════════════════════════════════════════
// mttcsr.com — Content Tool (frontend), adapted from the WOA Studio tool.
//
// Media items used by hero / cover (single) and gallery (array):
//   { kind:'image-existing', isExisting:true,  isVideo:false, name, previewUrl }
//   { kind:'image-uploaded', isExisting:false, isVideo:false, name, previewUrl, blob, ratio? }
//   { kind:'video-existing', isExisting:true,  isVideo:true,  name, previewUrl, thumbUrl }
//   { kind:'video-clip',     isExisting:false, isVideo:true,  name, previewUrl, thumbUrl, sourceId, params }
// ════════════════════════════════════════════════════════════════════════════

const MAX_DIM = 1920;              // longest side for uploaded images
const FIRST_YEAR = 2010;
const DEFAULT_CLIP = { bitrate: '1.5M', maxrate: '3M', fps: 25 };
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

let isDirty = false;

const state = {
  mode: 'create',
  originalSlug: null,
  published: true,
  title: '', slug: '', subtitle: '', yearMonth: '',
  context: '', award: '', role: '', tags: [], text: '',
  sources: [],
  hero: null,
  cover: null,
  useCustomCover: false,
  gallery: [],
};

const $ = (id) => document.getElementById(id);
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function markDirty() { isDirty = true; $('btn-save').disabled = false; }
function clearDirty() { isDirty = false; $('btn-save').disabled = true; }

function getQuality() { return parseInt($('quality').value, 10) / 100; }
function fmtSize(b) { return b < 1024 * 1024 ? Math.round(b / 1024) + ' KB' : (b / 1024 / 1024).toFixed(1) + ' MB'; }
function fmtDuration(s) {
  if (s == null) return '';
  const m = Math.floor(s / 60), sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
function setStatus(id, msg, type) {
  const el = $(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'convert-status' + (type ? ' ' + type : '');
}

// ── Init ────────────────────────────────────────────────────────────────────
window.onload = () => {
  initDate();
  loadDashboard();
  setupDropzones();
  setupFileInputs();
  setupSourcesInput();
  setupGlobalEscape();
  $('slug').addEventListener('input', function () {
    this.dataset.modified = 'true';
    updateState();
  });
};

window.addEventListener('beforeunload', (e) => {
  if (isDirty && $('view-editor').style.display === 'block') e.preventDefault();
});

function showDashboard() {
  if (isDirty && $('view-editor').style.display === 'block' && !confirm('Ci sono modifiche non salvate. Uscire comunque?')) return;
  $('view-dashboard').style.display = 'block';
  $('view-editor').style.display = 'none';
  $('btn-back').style.display = 'none';
  $('btn-new').style.display = 'block';
  clearDirty();
  window.scrollTo(0, 0);
  loadDashboard();
}

function showEditor(isEdit) {
  $('view-dashboard').style.display = 'none';
  $('view-editor').style.display = 'block';
  $('btn-back').style.display = 'inline-block';
  $('btn-new').style.display = 'none';
  $('editor-title').innerHTML = isEdit
    ? 'Modifica Progetto <span id="status-info" class="status-badge">OK</span>'
    : 'Crea Progetto <span id="status-info" class="status-badge">Incompleto</span>';
  window.scrollTo(0, 0);
  updateState();
  clearDirty();
}

// ── Dashboard ───────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const res = await fetch('/api/works');
    const works = await res.json();
    if (!res.ok) throw new Error(works.error || 'Errore server');
    renderGrid(works);
    $('loading-dashboard').style.display = works.length ? 'none' : 'block';
    if (!works.length) $('loading-dashboard').textContent = 'Nessun progetto. Clicca "+ Nuovo Progetto".';
  } catch (e) {
    $('loading-dashboard').style.display = 'block';
    $('loading-dashboard').textContent = 'Errore caricamento: ' + e.message;
  }
}

function renderGrid(works) {
  const sec = $('sec-works');
  const grid = $('grid-works');
  if (!works.length) { sec.style.display = 'none'; return; }
  sec.style.display = 'block';
  grid.innerHTML = works.map((w) => {
    const bg = w.thumb ? `url('/media/${w.slug}/${encodeURIComponent(w.thumb)}')` : 'none';
    const isDraft = !w.published;
    return `
      <div class="project-card ${isDraft ? 'is-draft' : ''}">
        <div onclick="openEdit('${w.slug}')" style="cursor:pointer">
          <div class="card-thumb ${w.isVideo ? 'card-thumb-video' : ''}" style="background-image: ${bg}">
            ${w.isVideo ? '<span class="card-thumb-play">▶</span>' : ''}
          </div>
          ${isDraft ? '<span class="card-badge">Bozza</span>' : ''}
          <div class="card-body">
            <div class="card-title">${escapeHtml(w.title)}</div>
            <div class="card-sub">${escapeHtml(w.subtitle)}</div>
            <div class="card-meta"><span>${escapeHtml(w.yearMonth || 'senza data')}</span></div>
          </div>
        </div>
        <div class="card-actions">
          <button class="card-action-btn" onclick="togglePublished(event, '${w.slug}', ${isDraft})"
            title="${isDraft ? 'Rendi il progetto visibile sul sito' : 'Nascondi il progetto dal sito (resta in archivio)'}">${isDraft ? 'Mostra' : 'Nascondi'}</button>
          <button class="card-action-btn danger" onclick="deleteProject(event, '${w.slug}')" title="Elimina progetto e tutti i media">Elimina</button>
        </div>
      </div>`;
  }).join('');
}

async function deleteProject(event, slug) {
  event.stopPropagation();
  const ok = confirm(
    `ELIMINARE "${slug}"?\n\n` +
    `Verranno cancellati definitivamente:\n` +
    `  • src/content/works/${slug}.md\n` +
    `  • tutti i media in src/assets/works/${slug}/\n\n` +
    `Azione NON reversibile (salvo git). Per toglierlo solo dal sito usa "Nascondi".`
  );
  if (!ok) return;
  try {
    const res = await fetch(`/api/works/${slug}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Errore eliminazione');
    loadDashboard();
  } catch (e) {
    alert('Errore: ' + e.message);
  }
}

async function togglePublished(event, slug, isDraft) {
  event.stopPropagation();
  const next = isDraft;
  if (!confirm(next ? `Mostrare "${slug}" sul sito?` : `Nascondere "${slug}" dal sito? Resta in archivio e puoi riattivarlo.`)) return;
  try {
    const res = await fetch(`/api/published/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: next }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Errore aggiornamento');
    loadDashboard();
  } catch (e) {
    alert('Errore: ' + e.message);
  }
}

// ── Editor flow ─────────────────────────────────────────────────────────────
function resetState() {
  Object.assign(state, {
    mode: 'create', originalSlug: null, published: true,
    title: '', slug: '', subtitle: '', yearMonth: '',
    context: '', award: '', role: '', tags: [], text: '',
    hero: null, cover: null, useCustomCover: false, gallery: [],
  });
  // Sources stay alive for the whole tool session.

  ['title', 'slug', 'subtitle', 'text', 'context', 'award', 'role', 'tags'].forEach((id) => { $(id).value = ''; });
  $('slug').dataset.modified = '';
  $('published').checked = true;
  $('year').value = String(new Date().getFullYear());
  $('month').value = String(new Date().getMonth() + 1).padStart(2, '0');
  $('use-custom-cover').checked = false;
  $('cover-field').style.display = 'none';
  ['sources-status', 'hero-status', 'cover-status', 'gallery-status'].forEach((id) => setStatus(id, ''));

  renderHeroGrid();
  renderCoverGrid();
  renderGalleryPreview();
  renderSourcesGrid();
}

function openEditor() {
  resetState();
  showEditor(false);
}

const mediaUrl = (slug, file) => `/media/${slug}/${encodeURIComponent(file)}`;

function buildExistingItem(file, type, slug) {
  const isVideo = type === 'video';
  return {
    kind: isVideo ? 'video-existing' : 'image-existing',
    isExisting: true,
    isVideo,
    name: file,
    previewUrl: mediaUrl(slug, file),
    thumbUrl: isVideo ? mediaUrl(slug, file.replace(/\.[^.]+$/, '.thumb.jpg')) : null,
  };
}

async function openEdit(slug) {
  try {
    const res = await fetch(`/api/works/${slug}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Non trovato');
    const fm = data.frontmatter;

    resetState();
    state.mode = 'edit';
    state.originalSlug = slug;

    $('title').value = fm.title || slug;
    $('slug').value = slug;
    $('slug').dataset.modified = 'true';
    $('subtitle').value = fm.subtitle || '';
    $('published').checked = fm.published !== false;
    $('text').value = fm.text || '';
    $('context').value = fm.context || '';
    $('award').value = fm.award || '';
    $('role').value = fm.role || '';
    $('tags').value = (fm.tags || []).join(', ');

    if (fm.yearMonth) {
      const [y, m] = String(fm.yearMonth).split('-');
      $('year').value = y;
      $('month').value = m || '';
    } else {
      $('year').value = '';
    }

    if (fm.hero) state.hero = buildExistingItem(fm.hero, fm.heroType || 'image', slug);
    if (fm.cover) {
      state.useCustomCover = true;
      state.cover = buildExistingItem(fm.cover, fm.coverType || 'image', slug);
      $('use-custom-cover').checked = true;
      $('cover-field').style.display = 'block';
    }
    state.gallery = (fm.gallery || []).map((m) => buildExistingItem(m.src, m.type, slug));

    renderHeroGrid();
    renderCoverGrid();
    renderGalleryPreview();
    renderSourcesGrid();
    showEditor(true);
  } catch (e) {
    alert('Errore caricamento progetto: ' + e.message);
  }
}

// ── Date, slug, fields ──────────────────────────────────────────────────────
function initDate() {
  const sel = $('year');
  const none = document.createElement('option');
  none.value = '';
  none.textContent = '— senza data';
  sel.appendChild(none);
  const cur = new Date().getFullYear();
  for (let y = cur + 1; y >= FIRST_YEAR; y--) {
    const o = document.createElement('option');
    o.value = String(y);
    o.textContent = String(y);
    sel.appendChild(o);
  }
}

function generateSlug(str) {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function updateTitle() {
  const slugInput = $('slug');
  if (!slugInput.dataset.modified) slugInput.value = generateSlug($('title').value);
  updateState();
}

function updateState() {
  state.title = $('title').value.trim();
  state.published = $('published').checked;
  state.slug = generateSlug($('slug').value.trim() || state.title);
  state.subtitle = $('subtitle').value.trim();
  const year = $('year').value;
  $('month').disabled = !year;
  const month = $('month').value;
  state.yearMonth = year ? (month ? `${year}-${month}` : year) : '';
  state.text = $('text').value;
  state.context = $('context').value.trim();
  state.award = $('award').value.trim();
  state.role = $('role').value.trim();
  state.tags = $('tags').value.split(',').map((t) => t.trim()).filter(Boolean);

  const ok = !!(state.title && state.hero);
  const badge = $('status-info');
  if (badge) {
    badge.className = ok ? 'status-badge complete' : 'status-badge';
    badge.textContent = ok ? 'Form OK' : 'Servono titolo e Hero';
  }
  const pubBadge = $('published-badge');
  pubBadge.className = state.published ? 'status-badge complete' : 'status-badge';
  pubBadge.textContent = state.published ? 'Pubblicato' : 'Bozza (nascosto)';

  markDirty();
}

// ── Image processing (WebP / HEIC) ─────────────────────────────────────────
const isHeifFile = (f) => /^heif?$/i.test(f.name.split('.').pop()) || /heic|heif/i.test(f.type);

async function convertImageToWebP(file, quality) {
  let sourceBlob = file;
  if (isHeifFile(file)) {
    try {
      const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
      sourceBlob = Array.isArray(converted) ? converted[0] : converted;
    } catch {
      throw new Error('Formato HEIC non supportato o corrotto');
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(sourceBlob);
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight;
      if (Math.max(w, h) > MAX_DIM) {
        if (w >= h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
        else { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Conversione WebP fallita'))), 'image/webp', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Errore caricamento immagine')); };
    img.src = url;
  });
}

async function rotateBlob(blob, degrees) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const rad = (degrees * Math.PI) / 180;
      const sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad));
      const width = img.width * cos + img.height * sin;
      const height = img.width * sin + img.height * cos;
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.translate(width / 2, height / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      URL.revokeObjectURL(url);
      canvas.toBlob(resolve, 'image/webp', getQuality());
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Errore durante la rotazione')); };
    img.src = url;
  });
}

async function imageItemFromFile(file) {
  const blob = await convertImageToWebP(file, getQuality());
  return {
    kind: 'image-uploaded', isExisting: false, isVideo: false,
    blob, previewUrl: URL.createObjectURL(blob),
    name: file.name.replace(/\.[^.]+$/, '.webp'),
  };
}

const revokeIfUploaded = (item) => { if (item?.kind === 'image-uploaded') URL.revokeObjectURL(item.previewUrl); };

// ── Sources ─────────────────────────────────────────────────────────────────
function setupSourcesInput() {
  $('sources-input').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files).filter((f) => f.type.startsWith('video/'));
    e.target.value = '';
    for (const f of files) await uploadSource(f);
  });
}

async function uploadSource(file) {
  showProgress('Caricamento video…', `"${file.name}"`, { showAbort: false });
  setStatus('sources-status', `Carico ${file.name}…`);
  const fd = new FormData();
  fd.append('video', file);

  try {
    const uploadData = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/source/upload');
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        $('progress-sub').textContent = `"${file.name}" — ${pct}% caricato`;
        updateProgress({ currentStep: 1, totalSteps: 2, currentName: 'Upload…', percent: pct });
      };
      xhr.onload = () => {
        let body = {};
        try { body = JSON.parse(xhr.responseText); } catch { /* not json */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(body);
        else reject(new Error(body.error || `Upload fallito (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error('Errore di rete durante il caricamento'));
      xhr.send(fd);
    });

    const { jobId, name } = uploadData;
    await new Promise((resolve, reject) => {
      const es = new EventSource(`/api/job/${jobId}/events`);
      es.addEventListener('progress', (ev) => {
        try {
          const d = JSON.parse(ev.data);
          $('progress-title').textContent = 'Generazione anteprima…';
          $('progress-sub').textContent = `"${name}" — conversione FFmpeg`;
          updateProgress({ ...d, currentStep: 2, totalSteps: 2 });
        } catch { /* ignore malformed event */ }
      });
      es.addEventListener('done', (ev) => {
        es.close();
        const src = JSON.parse(ev.data);
        state.sources.push(src);
        renderSourcesGrid();
        setStatus('sources-status', `Sorgente pronta: ${src.name}`, 'ok');
        resolve();
      });
      es.addEventListener('error', (ev) => {
        if (!ev.data) return; // transport error: the browser reconnects
        es.close();
        let msg = 'Errore elaborazione proxy';
        try { msg = JSON.parse(ev.data).error || msg; } catch { /* keep default */ }
        reject(new Error(msg));
      });
    });
  } catch (e) {
    setStatus('sources-status', 'Errore: ' + e.message, 'err');
    alert('Caricamento sorgente fallito: ' + e.message);
  } finally {
    hideProgress();
  }
}

function renderSourcesGrid() {
  const grid = $('sources-grid');
  if (!state.sources.length) {
    grid.innerHTML = '<div class="sources-empty">Nessuna sorgente caricata. Aggiungi un file video qui sopra per iniziare.</div>';
    return;
  }
  grid.innerHTML = state.sources.map((s) => `
    <div class="source-card" data-id="${s.id}">
      <div class="source-thumb" style="background-image:${s.thumbUrl ? `url('${s.thumbUrl}')` : 'none'}">
        ${!s.thumbUrl ? '<span class="source-thumb-fallback">▶</span>' : ''}
      </div>
      <div class="source-info">
        <div class="source-name" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</div>
        <div class="source-meta">${fmtDuration(s.duration)}</div>
      </div>
      <div class="source-actions">
        <button type="button" class="source-btn" onclick="openClipEditor('${s.id}')">+ Crea clip</button>
        <button type="button" class="source-btn danger" onclick="removeSource('${s.id}')" title="Rimuovi sorgente">✕</button>
      </div>
    </div>`).join('');
}

async function removeSource(id) {
  const used = [state.hero, state.cover, ...state.gallery].filter((i) => i?.kind === 'video-clip' && i.sourceId === id).length;
  if (used && !confirm(`Questa sorgente è usata in ${used} clip. Se la rimuovi non potranno essere generate al salvataggio.\n\nProcedere?`)) return;
  try { await fetch('/api/source/' + id, { method: 'DELETE' }); } catch { /* already gone */ }
  state.sources = state.sources.filter((s) => s.id !== id);
  renderSourcesGrid();
}

// ── Source picker (from the "+ Clip da sorgente" buttons) ───────────────────
let pickerTargetSlot = null;

function pickClipForSlot(slot) {
  if (!state.sources.length) {
    alert('Carica prima un video nella sezione "Sorgenti Video", poi torna qui per estrarre una clip.');
    return;
  }
  if (state.sources.length === 1) {
    openClipEditor(state.sources[0].id, slot);
    return;
  }
  pickerTargetSlot = slot;
  $('source-picker-body').innerHTML = state.sources.map((s) => `
    <div class="picker-item" onclick="pickerPick('${s.id}')">
      <div class="picker-thumb" style="background-image:${s.thumbUrl ? `url('${s.thumbUrl}')` : 'none'}">${!s.thumbUrl ? '▶' : ''}</div>
      <div class="picker-info">
        <div class="picker-name">${escapeHtml(s.name)}</div>
        <div class="picker-meta">${fmtDuration(s.duration)}</div>
      </div>
    </div>`).join('');
  $('source-picker-modal').style.display = 'flex';
}

function pickerPick(sourceId) {
  const slot = pickerTargetSlot;
  closeSourcePicker();
  openClipEditor(sourceId, slot);
}

function closeSourcePicker() {
  $('source-picker-modal').style.display = 'none';
  pickerTargetSlot = null;
}

// ── Clip editor ─────────────────────────────────────────────────────────────
let clipCtx = null; // { sourceId, playheadInterval }

function openClipEditor(sourceId, defaultTarget = null) {
  const src = state.sources.find((s) => s.id === sourceId);
  if (!src) { alert('Sorgente non trovata.'); return; }
  clipCtx = { sourceId, playheadInterval: null };

  $('clip-source-name').textContent = `Sorgente: ${src.name}${src.duration ? ' · ' + fmtDuration(src.duration) : ''}`;
  const preview = $('clip-preview');
  const err = $('clip-error');
  err.style.display = 'none';
  preview.style.display = 'block';
  preview.src = src.proxyUrl;
  preview.onerror = () => { err.style.display = 'flex'; preview.style.display = 'none'; };
  preview.onloadedmetadata = () => { err.style.display = 'none'; };

  $('clip-start').value = '';
  $('clip-end').value = '';
  $('clip-bitrate').value = DEFAULT_CLIP.bitrate;
  $('clip-maxrate').value = DEFAULT_CLIP.maxrate;
  $('clip-fps').value = String(DEFAULT_CLIP.fps);

  ['hero', 'cover', 'gallery'].forEach((t) => { $('clip-target-' + t).checked = t === defaultTarget; });
  ['clip-start', 'clip-end'].forEach((id) => { $(id).oninput = updateClipTimelineSelection; });

  clipCtx.playheadInterval = setInterval(() => {
    const d = preview.duration || src.duration || 0;
    if (d) $('clip-timeline-playhead').style.left = (((preview.currentTime || 0) / d) * 100).toFixed(2) + '%';
  }, 100);

  updateClipTimelineSelection();
  $('clip-modal').style.display = 'flex';
}

function setClipFromPlayhead(which) {
  $('clip-' + which).value = ($('clip-preview').currentTime || 0).toFixed(2);
  updateClipTimelineSelection();
}

function updateClipTimelineSelection() {
  const src = state.sources.find((s) => s.id === clipCtx?.sourceId);
  const dur = $('clip-preview').duration || src?.duration || 0;
  const sel = $('clip-timeline-selection');
  const hint = $('clip-duration-hint');
  const start = parseFloat($('clip-start').value);
  const end = parseFloat($('clip-end').value);

  if (!dur || (isNaN(start) && isNaN(end))) {
    sel.style.left = '0%'; sel.style.width = '100%';
    hint.textContent = 'Lascia vuoto = video intero';
    return;
  }
  const s = isNaN(start) ? 0 : Math.max(0, start);
  const e = isNaN(end) ? dur : Math.min(dur, end);
  if (e <= s) {
    sel.style.left = '0%'; sel.style.width = '0%';
    hint.textContent = 'Fine deve essere maggiore di Inizio';
    return;
  }
  sel.style.left = ((s / dur) * 100).toFixed(2) + '%';
  sel.style.width = (((e - s) / dur) * 100).toFixed(2) + '%';
  hint.textContent = `Durata clip: ${(e - s).toFixed(2)}s`;
}

function closeClipEditor(confirmed) {
  const preview = $('clip-preview');
  const finish = () => {
    if (clipCtx?.playheadInterval) clearInterval(clipCtx.playheadInterval);
    preview.pause(); preview.removeAttribute('src'); preview.load();
    $('clip-modal').style.display = 'none';
    clipCtx = null;
  };
  if (!confirmed) { finish(); return; }

  const startVal = $('clip-start').value;
  const endVal = $('clip-end').value;
  const params = {
    start: startVal ? parseFloat(startVal) : null,
    end: endVal ? parseFloat(endVal) : null,
    bitrate: $('clip-bitrate').value.trim() || DEFAULT_CLIP.bitrate,
    maxrate: $('clip-maxrate').value.trim() || DEFAULT_CLIP.maxrate,
    fps: parseInt($('clip-fps').value, 10) || DEFAULT_CLIP.fps,
  };
  if (params.start !== null && params.end !== null && params.end <= params.start) {
    alert("La Fine deve essere maggiore dell'Inizio.");
    return;
  }
  const targets = ['hero', 'cover', 'gallery'].filter((t) => $('clip-target-' + t).checked);
  if (!targets.length) {
    alert('Seleziona almeno una destinazione (Hero, Cover o Gallery).');
    return;
  }

  const src = state.sources.find((s) => s.id === clipCtx.sourceId);
  const base = src.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 32);
  const range = (params.start !== null || params.end !== null) ? `_${(params.start ?? 0).toFixed(1)}-${params.end ?? 'fine'}` : '';
  const item = {
    kind: 'video-clip', isExisting: false, isVideo: true,
    sourceId: clipCtx.sourceId, params, name: `${base}${range}.webm`,
    previewUrl: src.proxyUrl, thumbUrl: src.thumbUrl,
  };

  targets.forEach((slot) => {
    if (slot === 'hero') { revokeIfUploaded(state.hero); state.hero = { ...item }; renderHeroGrid(); }
    if (slot === 'cover') {
      state.useCustomCover = true;
      $('use-custom-cover').checked = true;
      $('cover-field').style.display = 'block';
      revokeIfUploaded(state.cover);
      state.cover = { ...item };
      renderCoverGrid();
    }
    if (slot === 'gallery') { state.gallery.push({ ...item }); renderGalleryPreview(); }
  });

  finish();
  setStatus('sources-status', `Clip aggiunta a: ${targets.join(', ')}`, 'ok');
  updateState();
}

// ── Dropzones / file inputs ─────────────────────────────────────────────────
function setupDropzones() {
  document.querySelectorAll('.dropzone').forEach((dz) => {
    const input = dz.querySelector('input[type="file"]');
    if (!input) return;
    input.addEventListener('dragenter', () => dz.classList.add('dragover'));
    input.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    input.addEventListener('drop', () => dz.classList.remove('dragover'));
  });
}

async function handleSingleSlot(slot, file) {
  if (file.type.startsWith('video/')) {
    await uploadSource(file);
    alert(`I video passano dalla sezione "Sorgenti Video": il file è stato caricato lì. Usa "+ Clip da sorgente" per assegnarlo.`);
    return;
  }
  setStatus(`${slot}-status`, isHeifFile(file) ? 'HEIF…' : 'Conversione WebP…');
  try {
    const item = await imageItemFromFile(file);
    revokeIfUploaded(state[slot]);
    state[slot] = item;
    slot === 'hero' ? renderHeroGrid() : renderCoverGrid();
    setStatus(`${slot}-status`, `Pronto — ${fmtSize(item.blob.size)}`, 'ok');
    updateState();
  } catch (err) {
    setStatus(`${slot}-status`, 'Errore: ' + err.message, 'err');
  }
}

function setupFileInputs() {
  ['hero', 'cover'].forEach((slot) => {
    $(slot).addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (file) await handleSingleSlot(slot, file);
    });
  });

  $('gallery').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = '';
    if (!files.length) return;
    setStatus('gallery-status', 'Elaborazione file…');
    let added = 0;
    for (const file of files) {
      if (file.type.startsWith('video/')) { await uploadSource(file); continue; }
      try {
        state.gallery.push(await imageItemFromFile(file));
        added++;
      } catch (err) {
        console.error('Image error:', err);
      }
    }
    setStatus('gallery-status', added ? `Aggiunti ${added} file` : 'Nessuna immagine aggiunta (i video vanno in Sorgenti)', added ? 'ok' : '');
    renderGalleryPreview();
    updateState();
  });
}

// ── Hero / Cover ────────────────────────────────────────────────────────────
function renderSlotItem(item, slot) {
  const sizeLbl = item.kind === 'image-uploaded'
    ? fmtSize(item.blob.size)
    : item.kind === 'video-clip'
      ? 'Clip da sorgente'
      : '(File esistente)';
  const thumb = item.isVideo
    ? (item.thumbUrl
        ? `<div class="item-thumb" style="background-image:url('${item.thumbUrl}'); background-size:cover; background-position:center"><span class="item-thumb-play">▶</span></div>`
        : '<div class="item-thumb-video">▶</div>')
    : `<img class="item-thumb" src="${item.previewUrl}" alt="">`;
  const canRotate = item.kind === 'image-uploaded';
  return `
    <div class="media-item">
      ${thumb}
      <div class="item-info">
        <div class="item-name">${escapeHtml(item.name)}</div>
        <div class="item-size">${sizeLbl}</div>
      </div>
      <div class="item-btns">
        ${canRotate ? `<button class="iBtn" onclick="rotateSlot('${slot}',-90)" title="Ruota CCW">↺</button><button class="iBtn" onclick="rotateSlot('${slot}',90)" title="Ruota CW">↻</button>` : ''}
        <button class="iBtn del" onclick="removeSlot('${slot}')" title="Rimuovi">✕</button>
      </div>
    </div>`;
}

function renderHeroGrid() { $('hero-grid').innerHTML = state.hero ? renderSlotItem(state.hero, 'hero') : ''; }
function renderCoverGrid() { $('cover-grid').innerHTML = state.cover ? renderSlotItem(state.cover, 'cover') : ''; }

async function rotateSlot(slot, deg) {
  const item = state[slot];
  if (!item || item.kind !== 'image-uploaded') return;
  setStatus(`${slot}-status`, 'Rotazione…');
  try {
    URL.revokeObjectURL(item.previewUrl);
    item.blob = await rotateBlob(item.blob, deg);
    item.previewUrl = URL.createObjectURL(item.blob);
    slot === 'hero' ? renderHeroGrid() : renderCoverGrid();
    setStatus(`${slot}-status`, fmtSize(item.blob.size), 'ok');
    markDirty();
  } catch (e) {
    setStatus(`${slot}-status`, 'Errore: ' + e.message, 'err');
  }
}

function removeSlot(slot) {
  revokeIfUploaded(state[slot]);
  state[slot] = null;
  slot === 'hero' ? renderHeroGrid() : renderCoverGrid();
  updateState();
}

function toggleCustomCover() {
  state.useCustomCover = $('use-custom-cover').checked;
  $('cover-field').style.display = state.useCustomCover ? 'block' : 'none';
  if (!state.useCustomCover) {
    revokeIfUploaded(state.cover);
    state.cover = null;
    renderCoverGrid();
  }
  markDirty();
}

// ── Gallery (justified preview, like the site) ──────────────────────────────
// Same rule as src/components/works/Gallery.astro: grow ∝ clamped aspect ratio,
// normalised so a lone item on the last row fills it.
const GALLERY_RATIO_MIN = 9 / 16;
const GALLERY_RATIO_MAX = 16 / 9;
const galleryGrow = (ratio) =>
  (Math.min(GALLERY_RATIO_MAX, Math.max(GALLERY_RATIO_MIN, ratio)) / GALLERY_RATIO_MIN).toFixed(3);

function renderGalleryPreview() {
  const container = $('gallery-grid');
  container.innerHTML = state.gallery.map((item, idx) => {
    const grow = item.ratio ? galleryGrow(item.ratio) : '1';
    const src = item.isVideo ? item.thumbUrl : item.previewUrl;
    const canEdit = !item.isVideo;
    const canRotate = item.kind === 'image-uploaded';
    return `<div class="gc" data-idx="${idx}" style="--grow:${grow}">
      ${src
        ? `<img class="gc-img" src="${src}" draggable="false" alt="" onload="onGalleryImgLoad(this,${idx})">`
        : '<div class="gc-video">▶</div>'}
      <div class="gc-overlay">
        ${canEdit ? `<button class="gc-btn" onclick="openCropModal(${idx})" title="Ritaglia">✂</button>` : ''}
        ${canRotate ? `<button class="gc-btn" onclick="rotateGalleryItem(${idx},-90)" title="Ruota CCW">↺</button><button class="gc-btn" onclick="rotateGalleryItem(${idx},90)" title="Ruota CW">↻</button>` : ''}
        <button class="gc-btn del" onclick="removeGalleryItem(${idx})" title="Rimuovi">✕</button>
      </div>
      <div class="gc-drag" title="Trascina per riordinare">⠿</div>
      <div class="gc-label">${String(idx + 1).padStart(2, '0')}${item.isVideo ? ' ▶' : ''}</div>
    </div>`;
  }).join('');

  if (container.sortableInstance) container.sortableInstance.destroy();
  container.sortableInstance = new Sortable(container, {
    animation: 150, handle: '.gc-drag', ghostClass: 'is-dragging',
    onEnd(evt) {
      if (evt.oldIndex === evt.newIndex) return;
      const [moved] = state.gallery.splice(evt.oldIndex, 1);
      state.gallery.splice(evt.newIndex, 0, moved);
      renderGalleryPreview();
      markDirty();
    },
  });
}

function onGalleryImgLoad(imgEl, idx) {
  const item = state.gallery[idx];
  if (!item || !imgEl.naturalWidth) return;
  item.ratio = imgEl.naturalWidth / imgEl.naturalHeight;
  imgEl.closest('.gc')?.style.setProperty('--grow', galleryGrow(item.ratio));
}

async function rotateGalleryItem(idx, deg) {
  const item = state.gallery[idx];
  if (!item || item.kind !== 'image-uploaded') return;
  try {
    URL.revokeObjectURL(item.previewUrl);
    item.blob = await rotateBlob(item.blob, deg);
    item.previewUrl = URL.createObjectURL(item.blob);
    item.ratio = null;
    renderGalleryPreview();
    markDirty();
  } catch (e) {
    alert('Errore rotazione: ' + e.message);
  }
}

function removeGalleryItem(idx) {
  revokeIfUploaded(state.gallery[idx]);
  state.gallery.splice(idx, 1);
  renderGalleryPreview();
  markDirty();
}

// ── Crop modal (gallery images) ─────────────────────────────────────────────
const MIN_CROP = 40;
const cropState = {
  idx: null, ratio: 16 / 9,
  box: { x: 0, y: 0, w: 0, h: 0 },
  dragging: false, resizing: false,
  startMX: 0, startMY: 0, startBox: null,
};

function openCropModal(idx) {
  const item = state.gallery[idx];
  if (!item || item.isVideo) return;
  cropState.idx = idx;
  cropState.ratio = 16 / 9;
  const imgEl = $('crop-img');
  imgEl.onload = initCropBox;
  imgEl.src = item.previewUrl;
  document.querySelectorAll('.crop-preset').forEach((b, i) => b.classList.toggle('active', i === 0));
  $('crop-modal').style.display = 'flex';
}

function setCropRatio(ratio, btn) {
  cropState.ratio = ratio;
  document.querySelectorAll('.crop-preset').forEach((b) => b.classList.remove('active'));
  btn?.classList.add('active');
  initCropBox();
}

function initCropBox() {
  const imgEl = $('crop-img');
  const iw = imgEl.offsetWidth, ih = imgEl.offsetHeight;
  if (!iw || !ih) return;
  const r = cropState.ratio;
  let w, h;
  if (r >= 1) {
    w = Math.round(iw * 0.85); h = Math.round(w / r);
    if (h > ih * 0.9) { h = Math.round(ih * 0.9); w = Math.round(h * r); }
  } else {
    h = Math.round(ih * 0.85); w = Math.round(h * r);
    if (w > iw * 0.9) { w = Math.round(iw * 0.9); h = Math.round(w / r); }
  }
  cropState.box = { x: Math.round((iw - w) / 2), y: Math.round((ih - h) / 2), w, h };
  updateCropBox();
}

function updateCropBox() {
  const { x, y, w, h } = cropState.box;
  const box = $('crop-box');
  box.style.left = x + 'px'; box.style.top = y + 'px';
  box.style.width = w + 'px'; box.style.height = h + 'px';
}

function closeCropModal() {
  $('crop-modal').style.display = 'none';
  $('crop-img').src = '';
  cropState.idx = null;
}

async function confirmCrop() {
  const idx = cropState.idx;
  if (idx === null) return;
  const item = state.gallery[idx];
  const img = $('crop-img');
  const scaleX = img.naturalWidth / img.offsetWidth;
  const scaleY = img.naturalHeight / img.offsetHeight;
  const { x, y, w, h } = cropState.box;
  const sx = Math.round(x * scaleX), sy = Math.round(y * scaleY);
  const sw = Math.round(w * scaleX), sh = Math.round(h * scaleY);

  const btn = document.querySelector('.crop-btn-confirm');
  btn.disabled = true;
  btn.textContent = 'Elaborazione…';
  try {
    const blob = await new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = sw; canvas.height = sh;
      canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas vuoto'))), 'image/webp', getQuality());
    });
    revokeIfUploaded(item);
    Object.assign(item, {
      kind: 'image-uploaded', isExisting: false, blob,
      previewUrl: URL.createObjectURL(blob), ratio: null,
      name: item.name.replace(/\.[^.]+$/, '.webp'),
    });
    closeCropModal();
    renderGalleryPreview();
    markDirty();
  } catch (e) {
    alert('Errore ritaglio: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '✓ Applica ritaglio';
  }
}

document.addEventListener('mousedown', (e) => {
  if (cropState.idx === null) return;
  const handle = $('crop-handle-br');
  const box = $('crop-box');
  if (e.target === handle) cropState.resizing = true;
  else if (box.contains(e.target)) cropState.dragging = true;
  else return;
  cropState.startMX = e.clientX;
  cropState.startMY = e.clientY;
  cropState.startBox = { ...cropState.box };
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!cropState.dragging && !cropState.resizing) return;
  const imgEl = $('crop-img');
  const iw = imgEl.offsetWidth, ih = imgEl.offsetHeight;
  const dx = e.clientX - cropState.startMX;
  const dy = e.clientY - cropState.startMY;
  if (cropState.dragging) {
    cropState.box.x = Math.max(0, Math.min(iw - cropState.startBox.w, cropState.startBox.x + dx));
    cropState.box.y = Math.max(0, Math.min(ih - cropState.startBox.h, cropState.startBox.y + dy));
  } else {
    let nw = Math.max(MIN_CROP, cropState.startBox.w + dx);
    let nh = nw / cropState.ratio;
    const maxW = iw - cropState.box.x, maxH = ih - cropState.box.y;
    if (nw > maxW) { nw = maxW; nh = nw / cropState.ratio; }
    if (nh > maxH) { nh = maxH; nw = nh * cropState.ratio; }
    cropState.box.w = Math.round(nw);
    cropState.box.h = Math.round(nh);
  }
  updateCropBox();
});

document.addEventListener('mouseup', () => { cropState.dragging = false; cropState.resizing = false; });

// ── Save (SSE progress + abort) ─────────────────────────────────────────────
let currentJobId = null;

function itemToDef(item, bag, fieldPrefix) {
  if (!item) return null;
  if (item.isExisting) return { kind: 'existing', src: item.name, type: item.isVideo ? 'video' : 'image' };
  if (item.kind === 'image-uploaded') {
    const fileId = `${fieldPrefix}__upload__${bag.counter++}`;
    bag.files.push({ id: fileId, blob: item.blob, name: item.name });
    return { kind: 'upload-image', fileId, type: 'image' };
  }
  if (item.kind === 'video-clip') return { kind: 'clip', sourceId: item.sourceId, params: item.params, type: 'video' };
  return null;
}

async function saveProject() {
  updateState();
  if (!state.title || !state.hero) { alert('Servono almeno Titolo e Hero.'); return; }
  if (!SLUG_RE.test(state.slug)) { alert('Slug non valido: usa solo lettere minuscole, numeri e trattini.'); return; }

  const fd = new FormData();
  const bag = { counter: 0, files: [] };
  const fields = {
    title: state.title, slug: state.slug, subtitle: state.subtitle,
    published: String(state.published), yearMonth: state.yearMonth,
    text: state.text, context: state.context, award: state.award, role: state.role,
    tags: JSON.stringify(state.tags),
    useCustomCover: String(state.useCustomCover && !!state.cover),
  };
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  if (state.originalSlug) fd.append('originalSlug', state.originalSlug);

  fd.append('heroDef', JSON.stringify(itemToDef(state.hero, bag, 'hero')));
  if (state.useCustomCover && state.cover) fd.append('coverDef', JSON.stringify(itemToDef(state.cover, bag, 'cover')));
  fd.append('galleryMap', JSON.stringify(state.gallery.map((it, i) => itemToDef(it, bag, `gallery-${i}`))));
  bag.files.forEach((f) => fd.append(f.id, f.blob, f.name));

  showProgress('Avvio salvataggio…', 'Preparazione file…');
  try {
    const res = await fetch('/api/save', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Errore salvataggio');
    currentJobId = data.jobId;
    subscribeJob(data.jobId);
  } catch (e) {
    hideProgress();
    alert('Errore salvataggio: ' + e.message);
  }
}

function subscribeJob(jobId) {
  const es = new EventSource(`/api/job/${jobId}/events`);
  const end = () => { es.close(); currentJobId = null; hideProgress(); };

  es.addEventListener('progress', (ev) => {
    try { updateProgress(JSON.parse(ev.data)); } catch { /* ignore malformed event */ }
  });
  es.addEventListener('done', () => {
    end();
    clearDirty();
    alert('Progetto salvato. Ricordati di fare commit e push per pubblicarlo.');
    showDashboard();
  });
  es.addEventListener('error', (ev) => {
    if (!ev.data) return; // transport error: the browser reconnects
    let msg = 'Errore sconosciuto';
    try { msg = JSON.parse(ev.data).error || msg; } catch { /* keep default */ }
    end();
    alert('Errore salvataggio: ' + msg);
  });
  es.addEventListener('aborted', () => {
    end();
    alert('Salvataggio annullato.');
  });
}

async function abortSave() {
  if (!currentJobId) { hideProgress(); return; }
  if (!confirm('Annullare il salvataggio? I file elaborati finora verranno scartati.')) return;
  try { await fetch(`/api/job/${currentJobId}/abort`, { method: 'POST' }); } catch { /* server gone */ }
}

// ── Progress overlay ────────────────────────────────────────────────────────
function showProgress(title, sub, opts = {}) {
  $('progress-title').textContent = title;
  $('progress-sub').textContent = sub;
  $('progress-step-label').textContent = 'Preparazione…';
  $('progress-bar-fill').style.width = '0%';
  $('progress-detail').textContent = '';
  $('progress-abort-btn').style.display = opts.showAbort === false ? 'none' : 'block';
  $('progress-overlay').style.display = 'flex';
}

function updateProgress(d) {
  $('progress-overlay').style.display = 'flex';
  if (d.totalSteps > 0 && d.currentStep > 0) {
    const fraction = Math.max(0, Math.min(1, (d.currentStep - 1 + (d.percent || 0) / 100) / d.totalSteps));
    $('progress-bar-fill').style.width = (fraction * 100).toFixed(1) + '%';
    $('progress-step-label').textContent = `Step ${d.currentStep}/${d.totalSteps} — ${d.percent || 0}%`;
  } else {
    $('progress-step-label').textContent = 'Preparazione…';
  }
  $('progress-detail').textContent = d.currentName || '';
}

function hideProgress() { $('progress-overlay').style.display = 'none'; }

// ── Escape closes the top-most modal ────────────────────────────────────────
function setupGlobalEscape() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if ($('clip-modal').style.display === 'flex') { closeClipEditor(false); return; }
    if ($('source-picker-modal').style.display === 'flex') { closeSourcePicker(); return; }
    if ($('crop-modal').style.display === 'flex') closeCropModal();
  });
}

// ── Expose to inline handlers ───────────────────────────────────────────────
Object.assign(window, {
  openEditor, openEdit, showDashboard, updateState, updateTitle,
  toggleCustomCover, rotateSlot, removeSlot,
  rotateGalleryItem, removeGalleryItem, onGalleryImgLoad,
  openCropModal, setCropRatio, closeCropModal, confirmCrop,
  deleteProject, togglePublished,
  pickClipForSlot, pickerPick, closeSourcePicker, openClipEditor, closeClipEditor, setClipFromPlayhead,
  removeSource, saveProject, abortSave,
});
