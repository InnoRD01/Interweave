/**
 * Guard for write endpoints (image uploads).
 *
 * In production, /keystatic and /api/media/* sit behind Cloudflare Access
 * (Zero Trust → Access → Applications). Access adds a signed JWT to every
 * request it lets through. We verify that JWT here too, so the upload API stays
 * closed even if the Access rule is misconfigured or removed.
 *
 * Fails closed: if Access isn't configured, uploads are refused (except in dev).
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getSecret } from 'astro:env/server';

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

export type Editor = { email: string };

export async function requireEditor(request: Request): Promise<Editor | Response> {
  if (import.meta.env.DEV) return { email: 'dev@localhost' };

  const team = getSecret('ACCESS_TEAM_DOMAIN'); // e.g. "interweave.cloudflareaccess.com"
  const aud = getSecret('ACCESS_AUD');
  if (!team || !aud) {
    return new Response('Uploads are disabled: Cloudflare Access is not configured.', { status: 503 });
  }

  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return new Response('Unauthorized', { status: 401 });

  const issuer = `https://${team.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  jwks ??= createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer, audience: aud });
    return { email: String(payload.email ?? 'unknown') };
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }
}
