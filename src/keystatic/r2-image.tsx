/**
 * A Keystatic field that uploads to Cloudflare R2 instead of committing the
 * image into Git.
 *
 * Stored value (in the project's frontmatter):  { key, w, h }
 *
 * Before uploading, the editor's browser scales anything larger than
 * MAX_EDGE down, so a 40 MB camera original becomes a roughly 2–4 MB master.
 * Cloudflare then makes the smaller sizes on demand.
 */
import { useRef, useState, type ReactElement } from 'react';
import type { BasicFormField, FormFieldStoredValue } from '@keystatic/core';

export type R2ImageValue = { key: string; w: number; h: number } | null;

const MAX_EDGE = 3200;

async function prepare(file: File): Promise<{ blob: Blob; name: string; w: number; h: number }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  if (scale === 1) {
    bitmap.close();
    return { blob: file, name: file.name, w: width, h: height };
  }
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
  return { blob, name: file.name.replace(/\.[^.]+$/, '') + '.jpg', w, h };
}

function previewUrl(key: string) {
  if (key.startsWith('/') || /^https?:/.test(key)) return key;
  return `/media/${key}`;
}

function Input({
  value,
  onChange,
  label,
  description,
  folder,
}: {
  value: R2ImageValue;
  onChange(v: R2ImageValue): void;
  label: string;
  description?: string;
  folder?: string;
}): ReactElement {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function upload(file: File) {
    try {
      setStatus('Preparing…');
      const { blob, name, w, h } = await prepare(file);
      setStatus(`Uploading ${(blob.size / 1024 / 1024).toFixed(1)} MB…`);
      const body = new FormData();
      body.set('file', new File([blob], name, { type: blob.type }));
      body.set('w', String(w));
      body.set('h', String(h));
      if (folder) body.set('folder', folder);
      const res = await fetch('/api/media/upload', { method: 'POST', body, credentials: 'include' });
      const data = (await res.json().catch(() => ({ error: res.statusText }))) as { key: string; w: number; h: number; error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      onChange({ key: data.key, w: data.w, h: data.h });
      setStatus(null);
    } catch (e) {
      setStatus(`Upload failed: ${(e as Error).message}`);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
      {description && <div style={{ fontSize: 13, opacity: 0.7 }}>{description}</div>}
      {value?.key && (
        <img
          src={previewUrl(value.key)}
          alt=""
          style={{ maxWidth: 320, maxHeight: 200, objectFit: 'contain', background: '#eee' }}
        />
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => input.current?.click()}>
          {value?.key ? 'Replace image' : 'Upload image'}
        </button>
        {value?.key && (
          <button type="button" onClick={() => onChange(null)}>
            Remove
          </button>
        )}
        {value?.key && (
          <code style={{ fontSize: 12, opacity: 0.6 }}>
            {value.key} · {value.w}×{value.h}
          </code>
        )}
      </div>
      {status && <div style={{ fontSize: 13 }}>{status}</div>}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function parseStored(v: FormFieldStoredValue): R2ImageValue {
  if (v && typeof v === 'object' && !Array.isArray(v) && 'key' in v && typeof v.key === 'string') {
    return { key: v.key, w: Number(v.w) || 0, h: Number(v.h) || 0 };
  }
  return null;
}

export function r2Image<Required extends boolean = false>({
  label,
  description,
  folder,
  required,
}: {
  label: string;
  description?: string;
  /** R2 "folder" prefix for uploads from this field. */
  folder?: string;
  required?: Required;
}): BasicFormField<R2ImageValue, Required extends true ? NonNullable<R2ImageValue> : R2ImageValue> {
  return {
    kind: 'form',
    label,
    Input: (props) => <Input {...props} label={label} description={description} folder={folder} />,
    defaultValue: () => null,
    parse: parseStored,
    serialize: (value) => ({ value: value ?? undefined }),
    validate(value) {
      if (required && !value) throw new Error(`${label} is required`);
      return value as any;
    },
    reader: { parse: (v) => parseStored(v) as any },
  };
}
