/**
 * Stand-in for `cloudflare:workers` when running `npm run dev` (Node).
 *
 * Keystatic's local mode edits files on disk, which needs Node, while the live
 * site runs on Cloudflare Workers. In dev, astro.config.mjs points
 * `cloudflare:workers` here, and Wrangler gives us the same bindings (R2 etc.)
 * backed by the local `.wrangler/state` store. So uploads made in the local CMS
 * land in the same local bucket that `npm run images:upload -- --local` writes to.
 */
import { getPlatformProxy } from 'wrangler';

const proxy = await getPlatformProxy<Env>({ persist: true });

export const env = proxy.env;
