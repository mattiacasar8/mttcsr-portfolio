# mttcsr.com

Personal portfolio of Mattia Casarotto — Multimedia Designer.
Static site built with [Astro](https://astro.build), deployed on Cloudflare Pages.

## Commands

Requires Node 22 (see `.node-version`) and pnpm.

```bash
pnpm install        # install dependencies
pnpm dev            # dev server on http://localhost:4321
pnpm build          # static build → dist/
pnpm preview        # preview the build
pnpm check          # type check
pnpm content-tool   # content manager on http://localhost:3030/tool.html
```

## Structure

```
src/
├── content.config.ts        # 'works' collection schema
├── content/works/           # one .md per project (frontmatter only)
│   └── _template.md         # reference, published: false
├── assets/works/<slug>/     # project media (hero, cover, gallery-N, *.thumb.jpg posters)
├── pages/
│   ├── index.astro          # hero canvas + about + selected works + CTA
│   └── works/
│       ├── index.astro      # works grid
│       └── [slug].astro     # project page
├── components/
│   ├── layout/              # BaseLayout, SiteHeader, Footer, Loader
│   ├── home/HomeHero.astro  # name, nav, ASCII canvas, about
│   ├── works/               # WorkCard, WorksGrid, GalleryStrip, MetaList, ProjectNav
│   └── ui/                  # Nav, Media, Arrow
├── lib/                     # site config, media resolver, works helpers
├── scripts/                 # morpho-ascii.js (canvas), loader.js
└── styles/
    ├── tokens.css           # design tokens — every visual value lives here
    └── global.css           # reset, base and shared text styles
content-tool/                # local content manager (Express + FFmpeg)
public/                      # favicon, og-image
```

## Adding a project

### With the content tool (recommended)

Double-click `start-tool.sh` (or run `pnpm content-tool`) and open http://localhost:3030/tool.html.

- **Images** are converted to WebP in the browser (longest side 1920px, quality slider). HEIC is supported. Gallery images can be cropped, rotated and reordered.
- **Videos** go through *Sorgenti Video*: upload the original once, cut clips and assign them to Hero, Cover or Gallery. On save they are encoded to WebM VP9, 720p, no audio, with a `.thumb.jpg` poster.
- Saving writes `src/content/works/<slug>.md` and `src/assets/works/<slug>/`. Commit and push to publish.
- *Nascondi* sets `published: false` without deleting anything.

### By hand

Copy `src/content/works/_template.md` to `<slug>.md`, put the media in `src/assets/works/<slug>/` and set `published: true`. Videos should have a `<name>.thumb.jpg` poster next to them.

| Field | Required | Notes |
| --- | --- | --- |
| `title` | yes | |
| `subtitle` | no | shown under the title on the project page |
| `hero` / `heroType` | yes | `image` or `video` |
| `cover` / `coverType` | no | card media in the grid; defaults to hero |
| `yearMonth` | no | `YYYY` or `YYYY-MM`; sorts the grid (newest first), year shown on cards |
| `text` | no | description, line breaks kept |
| `context`, `award`, `role` | no | meta column on the project page |
| `tags` | no | free text, shown on cards and project page |
| `gallery` | no | list of `{ src, type }`, shown as the scrolling strip |
| `published` | no | defaults to `true` |

Projects without `yearMonth` are listed after dated ones, alphabetically. Previous/next links follow the grid order and wrap around.

## Media pipeline

- Images in `src/assets/works/` are processed at build time by `astro:assets` (responsive `srcset`, WebP). Animated WebP stays animated.
- Videos are copied as-is (already encoded by the tool) and use the poster frame until they play.

## Design system

Tokens are in `src/styles/tokens.css`. Monochrome (white at 100/80/60% on black), one accent `#00aa00` taken from the canvas palette (key `2`), Instrument Serif for voice and UI, Inter for body text. Fonts are self-hosted via `@fontsource`.

## Canvas

`src/scripts/morpho-ascii.js` renders a Gray-Scott reaction-diffusion field as ASCII.
Draw with mouse/touch; hold Shift to erase, Ctrl/Cmd to add the other chemical; keys `1`–`9` switch palette, `0` toggles rainbow mode.

## Deploy

Cloudflare Pages: build command `pnpm build`, output directory `dist`, Node version from `.node-version`.

---

© Mattia Casarotto
