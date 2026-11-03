// @ts-check
import { defineConfig, envField } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import node from '@astrojs/node';
import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import keystatic from '@keystatic/astro';

/**
 * `npm run dev` runs on Node so the Keystatic CMS can edit files on disk
 * (its local mode can't run inside the Workers runtime). Cloudflare bindings such
 * as the R2 bucket are still provided, locally, by Wrangler; see
 * src/lib/dev-cloudflare-env.ts. `npm run dev:worker` and every build use the
 * real Workers runtime.
 */
const NODE_DEV = process.env.INTERWEAVE_NODE_DEV === '1';

export default defineConfig({
  site: 'https://studiointerweave.com',

  // Pages are static by default. Only the CMS admin, the upload API and the
  // /media route run on the Worker (they set `prerender = false`).
  adapter: NODE_DEV
    ? node({ mode: 'standalone' })
    : cloudflare({
        // Project photography lives in R2 and is resized by Cloudflare at the edge
        // (see src/lib/media.ts). Astro never processes it at build time, so build
        // time does not grow with the photo library.
        imageService: 'passthrough',
        prerenderEnvironment: 'node',
      }),

  integrations: [react(), markdoc(), keystatic()],

  vite: {
    resolve: NODE_DEV
      ? { alias: { 'cloudflare:workers': new URL('./src/lib/dev-cloudflare-env.ts', import.meta.url).pathname } }
      : {},
    // Keystatic's API depends on a few CommonJS packages. The Workers runtime
    // only runs ES modules, so have Vite pre-bundle them (not needed on Node).
    ssr: NODE_DEV
      ? {}
      : { optimizeDeps: { include: ['@keystatic/core > cookie', '@keystatic/core > superstruct'] } },
  },

  env: {
    schema: {
      // Where images are served from. "/media" uses this Worker's R2 binding;
      // in production you can point it at an R2 custom domain instead,
      // e.g. "https://media.studiointerweave.com".
      PUBLIC_MEDIA_BASE: envField.string({ context: 'client', access: 'public', default: '/media' }),
      // Turn on once Image Transformations is enabled on the Cloudflare zone.
      PUBLIC_IMAGE_TRANSFORMS: envField.boolean({ context: 'client', access: 'public', default: false }),
      // Cloudflare Access, which guards /keystatic and the upload API.
      ACCESS_TEAM_DOMAIN: envField.string({ context: 'server', access: 'secret', optional: true }),
      ACCESS_AUD: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Keystatic GitHub mode (created by the /keystatic setup wizard).
      KEYSTATIC_GITHUB_CLIENT_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      KEYSTATIC_GITHUB_CLIENT_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      KEYSTATIC_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      PUBLIC_KEYSTATIC_GITHUB_APP_SLUG: envField.string({ context: 'client', access: 'public', optional: true }),
    },
  },
});
