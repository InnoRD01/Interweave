/**
 * POST /api/media/upload  (multipart form: file, folder?, w, h)
 *
 * Stores the image in R2 under a content-hashed key and returns
 * `{ key, w, h }`, which is exactly what the CMS image field saves.
 * The editor's browser has already downscaled oversized photos (see
 * src/keystatic/r2-image.tsx), so originals stay a sensible size.
 */
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireEditor } from '../../../lib/access';

export const prerender = false;

const MAX_BYTES = 40 * 1024 * 1024;
const TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60) || 'image';

export const POST: APIRoute = async ({ request }) => {
  const editor = await requireEditor(request);
  if (editor instanceof Response) return editor;

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return json({ error: 'No file' }, 400);
  const ext = TYPES[file.type];
  if (!ext) return json({ error: `Unsupported type ${file.type}. Use JPEG, PNG, WebP or AVIF.` }, 415);
  if (file.size > MAX_BYTES) return json({ error: 'File is larger than 40 MB.' }, 413);

  const w = Number(form.get('w')) || 0;
  const h = Number(form.get('h')) || 0;
  const folder = slugify(String(form.get('folder') || 'uploads'));

  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = [...new Uint8Array(digest)].slice(0, 4).map((b) => b.toString(16).padStart(2, '0')).join('');
  const base = slugify(file.name.replace(/\.[^.]+$/, ''));
  const key = `${folder}/${base}-${hash}.${ext}`;

  // Same bytes → same key, so re-uploading a photo is a no-op.
  if (!(await env.MEDIA.head(key))) {
    await env.MEDIA.put(key, bytes, {
      httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' },
      customMetadata: { w: String(w), h: String(h), uploadedBy: editor.email, originalName: file.name },
    });
  }

  return json({ key, w, h });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
