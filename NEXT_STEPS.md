# Next steps

State of the Astro migration and what is left before it goes live.
Branch: `astro-migration` (not merged into `main`, no PR open).

## Done

- Astro 6 static site replacing the old HTML/CSS/JS site. Home canvas, loader and about text are unchanged.
- `/works` mosaic grid (WOA Studio values). The project pages have:
  - meta on the left, text on the right;
  - a justified gallery with lightbox (WOA system, balanced rows, max 5 per row below 2000px);
  - previous/next navigation.
- `/about` with bio, links and a Web3Forms contact form (it works; the first messages landed in spam).
- Content tool ported from WOA (`pnpm content-tool`): WebP images, VP9 WebM videos, gallery preview matching the site.
- Design tokens in `src/styles/tokens.css`. Monochrome; inverted boxes for tags and the active nav item, underline on hover.

## Before going live

1. **Cloudflare Pages build settings**:
   - build command `pnpm build`;
   - output directory `dist`;
   - Node from `.node-version` (22).
2. Check a **branch preview** on Cloudflare before merging. If `sharp` or `esbuild` fail to build there, pin pnpm. Options: a `packageManager` field in `package.json`, or the `PNPM_VERSION` env var. Local builds use `pnpm-workspace.yaml` → `allowBuilds`.
3. Merge `astro-migration` into `main`.
4. In Gmail, mark the Web3Forms messages as "not spam" so the next ones reach the inbox.

## Content (in progress)

- Hidden projects (`published: false`), to review and republish:
  - 1600 The New Furnace;
  - Chora;
  - Eni Agri Hub;
  - LV Diamond Illustrations;
  - The Footprint.
- **Transparent images**: the content tool keeps transparency, which is unreadable on black. Flatten them before uploading. Background used so far: `#f5f5f0`.
- The Footprint: portrait image cropped in its landscape card, needs a `cover`.
- Media skipped because Drive downloads were capped at ~10MB:
  - LV Diamond 02/05 and the magazine;
  - the Terna mp4;
  - more Plandemic photos.
- Arcipelago was replaced by Topography of a Talk (its evolution).

## Open decisions

- Home subtitle: `site.role` is "multimedia designer" (`src/lib/site.ts`), while the bio says "creative technologist and multimedia artist". Align or keep?
- Active nav item: still an inverted box. Switch to underline like the other links?
