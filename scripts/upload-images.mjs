#!/usr/bin/env node
/**
 * Bulk upload a photo shoot to R2, then (optionally) add it to a project's gallery.
 *
 *   npm run images:upload -- <folder> --project <slug> [--append] [--credit "Name"] [--local]
 *
 *   <folder>     A folder of JPEG/PNG/WebP/TIFF files (e.g. ./photos/hillside-house)
 *   --project    Project slug; used as the R2 prefix: projects/<slug>/...
 *   --append     Also add the images to src/content/projects/<slug>.mdoc (gallery)
 *   --credit     Photo credit to put on every appended image
 *   --local      Upload to the local dev bucket instead of the real one
 *
 * Each file is scaled so its long edge is at most 3200 px, saved as a high-quality
 * JPEG, and named with a hash of its contents, so uploading the same shoot again
 * changes nothing. Needs `npx wrangler login` once (not needed with --local).
 */
import { readdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, extname, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import YAML from 'yaml';

const BUCKET = 'interweave-media';
const MAX_EDGE = 3200;
const EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff']);

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    project: { type: 'string' },
    append: { type: 'boolean', default: false },
    credit: { type: 'string', default: '' },
    local: { type: 'boolean', default: false },
  },
});

const folder = positionals[0];
if (!folder || !values.project) {
  console.error('Usage: npm run images:upload -- <folder> --project <slug> [--append] [--credit "Name"] [--local]');
  process.exit(1);
}
const slug = values.project.toLowerCase().replace(/[^a-z0-9-]/g, '-');
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'image';

const files = (await readdir(folder)).filter((f) => EXTS.has(extname(f).toLowerCase())).sort();
if (!files.length) {
  console.error(`No images found in ${folder}`);
  process.exit(1);
}

const tmp = await mkdtemp(join(tmpdir(), 'interweave-'));
const uploaded = [];
try {
  for (const [i, file] of files.entries()) {
    const out = await sharp(await readFile(join(folder, file)))
      .rotate() // respect camera orientation
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .withMetadata({ orientation: undefined })
      .toColorspace('srgb')
      .jpeg({ quality: 88, mozjpeg: true, progressive: true })
      .toBuffer({ resolveWithObject: true });

    const hash = createHash('sha256').update(out.data).digest('hex').slice(0, 8);
    const key = `projects/${slug}/${slugify(basename(file, extname(file)))}-${hash}.jpg`;
    const path = join(tmp, `${hash}.jpg`);
    await writeFile(path, out.data);

    process.stdout.write(`[${i + 1}/${files.length}] ${file} → ${key} (${(out.data.length / 1e6).toFixed(1)} MB) … `);
    execFileSync(
      'npx',
      [
        'wrangler', 'r2', 'object', 'put', `${BUCKET}/${key}`,
        '--file', path,
        '--content-type', 'image/jpeg',
        '--cache-control', 'public, max-age=31536000, immutable',
        values.local ? '--local' : '--remote',
      ],
      { stdio: ['ignore', 'ignore', 'inherit'] },
    );
    console.log('ok');
    uploaded.push({ key, w: out.info.width, h: out.info.height, name: file });
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}

if (values.append) {
  const path = `src/content/projects/${slug}.mdoc`;
  const src = await readFile(path, 'utf8');
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`Could not read frontmatter in ${path}`);
  const doc = YAML.parseDocument(m[1]);
  const gallery = doc.get('gallery') ?? new YAML.YAMLSeq();
  for (const u of uploaded) {
    gallery.add(doc.createNode({ image: { key: u.key, w: u.w, h: u.h }, alt: '', caption: '', credit: values.credit, layout: 'full' }));
  }
  doc.set('gallery', gallery);
  await writeFile(path, `---\n${doc.toString().trimEnd()}\n---\n${m[2]}`);
  console.log(`\nAdded ${uploaded.length} images to ${path}. Open it in /keystatic to reorder, add captions and set layouts.`);
} else {
  console.log('\nUploaded. Gallery entries (paste into a project, or re-run with --append):\n');
  console.log(YAML.stringify(uploaded.map(({ key, w, h }) => ({ image: { key, w, h }, credit: values.credit, layout: 'full' }))));
}
