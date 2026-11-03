/**
 * Image delivery.
 *
 * Originals live in the R2 bucket under content-hashed keys
 * (e.g. `projects/pavilion-house/east-court-3f9a1c2e.jpg`). The repo only
 * stores the key and the image's pixel size.
 *
 * In production, Cloudflare Image Transformations resizes each image on the fly
 * via `/cdn-cgi/image/<options>/<source>`. Transformations are cached at the edge,
 * and keys never change for the same bytes, so everything can be cached for a
 * year and never purged.
 *
 * We only ever ask for the widths below. Cloudflare bills per *unique*
 * transformation, so a small fixed set keeps the bill predictable.
 */
import { PUBLIC_MEDIA_BASE, PUBLIC_IMAGE_TRANSFORMS } from 'astro:env/client';

export const WIDTHS = [480, 800, 1200, 1600, 2400] as const;

export type MediaImage = {
  /** R2 object key, or a site-relative path like `/placeholders/a.svg`. */
  key: string;
  w: number;
  h: number;
};

const isLocal = (key: string) => key.startsWith('/') || /^https?:\/\//.test(key);

/** URL of the untouched original. */
export function originalUrl(key: string): string {
  if (isLocal(key)) return key;
  return `${PUBLIC_MEDIA_BASE.replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

/** URL of a resized variant. Falls back to the original when transforms are off. */
export function variantUrl(key: string, width: number, quality = 80): string {
  const src = originalUrl(key);
  if (!PUBLIC_IMAGE_TRANSFORMS || isLocal(key) || src.endsWith('.svg')) return src;
  return `/cdn-cgi/image/width=${width},quality=${quality},format=auto,fit=scale-down/${src.replace(/^\//, '')}`;
}

export function srcset(img: MediaImage): string | undefined {
  if (!PUBLIC_IMAGE_TRANSFORMS || isLocal(img.key)) return undefined;
  return WIDTHS.filter((w) => w <= img.w || w === WIDTHS[0])
    .map((w) => `${variantUrl(img.key, w)} ${w}w`)
    .join(', ');
}
