# Interweave

Website for Interweave, an architecture studio in Gangtok, Sikkim.

**Stack:** [Astro](https://astro.build) (static pages) · [Keystatic](https://keystatic.com) (CMS, commits to GitHub) · Cloudflare Workers (hosting) · Cloudflare R2 (photographs).

```
/                     Selected work: projects ticked "Show on home page"
/projects             All projects: Grid · List · Map, filter by type and status
/projects/<slug>      Title · year → lead image → narrative + facts → site & climate → gallery → next
/studio               Statement, approach, areas of work, people
/contact              Address, email, phone, enquiries, careers
/keystatic            The CMS (protected by Cloudflare Access in production)
```

## Running it locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:4321, and http://127.0.0.1:4321/keystatic for the CMS. Locally the CMS edits the files in `src/content/` directly, and image uploads go to a local R2 bucket stored in `.wrangler/`.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with the local CMS (runs on Node; Cloudflare bindings come from Wrangler) |
| `npm run dev:worker` | Dev server in the real Workers runtime (the CMS can't save in this mode) |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Build, then run the production Worker locally |
| `npm run check` | Type-check |
| `npm run images:upload` | Bulk-upload a photo shoot to R2 (see below) |
| `npm run cms:github-setup` | One-time: run the CMS in GitHub mode to create the Keystatic GitHub App |

## Images: how they're stored and cached

There will be a lot of photography, so **images never go into Git** and **builds never process them**.

1. **Originals live in R2** (bucket `interweave-media`). R2 doesn't charge for bandwidth. Uploads are capped at a 3200 px long edge, so a 40 MB camera file becomes a 2–4 MB master.
2. **Each key includes a hash of the file's contents**, e.g. `projects/hillside-house/east-court-3f9a1c2e.jpg`. The same bytes always get the same key, so files are served with `Cache-Control: immutable, max-age=1 year` and **the cache never needs purging**. Replacing a photo creates a new key.
3. **Cloudflare resizes images at the edge.** `src/components/Picture.astro` builds a `srcset` from `/cdn-cgi/image/width=…,format=auto/…` at five fixed widths (480, 800, 1200, 1600, 2400). Each variant is made once, cached, and served as AVIF or WebP to browsers that support them. Cloudflare bills per *unique* transformation (a free allowance, then a small fee per thousand), so the fixed set of widths keeps the bill predictable.
4. **Git stores only `{ key, w, h }` per image.** The width and height let the browser reserve space before the image loads, so the page doesn't jump.

The result: the repo stays small, build time stays flat however many photos there are, and visitors download a properly sized, modern-format image from the nearest Cloudflare data centre.

### Adding images

- **One at a time (editors):** in the CMS, use **Upload image** on any image field. It uploads straight to R2.
- **A whole shoot (developer):**
  ```bash
  npm run images:upload -- ./photos/hillside-house --project hillside-house --append --credit "Photographer Name"
  ```
  This resizes, fingerprints and uploads every image, then adds them to the project's gallery. Afterwards, open the project in the CMS to reorder images, add captions and choose layouts (full / half / inset). Add `--local` to upload to the dev bucket instead. `/photos/` is git-ignored, so shoots can sit there safely.

## Going live on Cloudflare (one-time setup)

The full step-by-step guide, including moving the domain over from the
`morepeace` Pages project, is in [`DEPLOY.md`](DEPLOY.md).

**Where settings live:** non-secret settings (`PUBLIC_*`) go in the `vars` block
of `wrangler.jsonc`, which the build reads, and are committed to Git. Values typed
into the dashboard as plain-text variables are overwritten by that file on the
next deploy. Secrets (`ACCESS_*`, `KEYSTATIC_*`) go in the dashboard as **Secrets**
and are never committed.

## Content model

Edit the fields in `keystatic.config.ts`. `src/content.config.ts` mirrors them, so if they ever get out of step the build fails instead of publishing a broken page.

**Project:** title · show on home · sort order · status · typology · years started/completed · location · map position · client · site area · built-up area · team · collaborators · **site & climate** (altitude, rainfall, temperature, terrain, notes) · cover image · summary · gallery (image, alt text, caption, credit, layout) · narrative.

**Pages:** Site settings (name, tagline, SEO description, Instagram) · Studio · Contact.

All current content is **placeholder** and is meant to be replaced.
