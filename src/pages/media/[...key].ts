/**
 * Serves originals out of the R2 bucket through this Worker.
 *
 * This is the zero-setup path (it also works in `astro dev`, where Wrangler
 * simulates R2 locally). Once the site is live you can attach a custom domain to
 * the bucket (e.g. media.interweave.example) and set PUBLIC_MEDIA_BASE to it; then
 * Cloudflare's CDN serves originals directly and this route is no longer hit.
 */
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

const YEAR = 60 * 60 * 24 * 365;

export const GET: APIRoute = async ({ params, request, locals }) => {
  const key = params.key;
  if (!key) return new Response('Not found', { status: 404 });

  // Edge cache first: content-hashed keys mean a cached copy is never stale.
  // (`caches` doesn't exist in the Node dev server, so this is skipped there.)
  const cache = (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;
  const cached = await cache?.match(request);
  if (cached) return cached;

  const object = await env.MEDIA.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', `public, max-age=${YEAR}, immutable`);
  headers.set('access-control-allow-origin', '*');

  const response = new Response(object.body, { headers });
  if (cache) locals.cfContext.waitUntil(cache.put(request, response.clone()));
  return response;
};
