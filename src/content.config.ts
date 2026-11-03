import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** Mirrors keystatic.config.ts. If Keystatic writes bad data, the build fails loudly. */
const image = z.object({ key: z.string(), w: z.number(), h: z.number() });

const projects = defineCollection({
  loader: glob({ pattern: '*.mdoc', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    featured: z.boolean().default(false),
    order: z.number().nullish(),
    status: z.enum(['built', 'construction', 'design', 'unbuilt']),
    typology: z.enum(['residential', 'hospitality', 'institutional', 'cultural', 'commercial', 'interiors', 'landscape']),
    yearStart: z.number().nullish(),
    yearEnd: z.number().nullish(),
    location: z.string().default(''),
    coordinates: z.object({ lat: z.number().nullish(), lng: z.number().nullish() }).default({}),
    client: z.string().default(''),
    siteArea: z.string().default(''),
    builtArea: z.string().default(''),
    team: z.string().default(''),
    collaborators: z.array(z.object({ role: z.string(), name: z.string() })).default([]),
    site: z
      .object({
        altitude: z.string().default(''),
        rainfall: z.string().default(''),
        temperature: z.string().default(''),
        terrain: z.string().default(''),
        notes: z.string().default(''),
      })
      .default({ altitude: '', rainfall: '', temperature: '', terrain: '', notes: '' }),
    cover: image,
    coverAlt: z.string().default(''),
    summary: z.string().default(''),
    gallery: z
      .array(
        z.object({
          image,
          alt: z.string().default(''),
          caption: z.string().default(''),
          credit: z.string().default(''),
          layout: z.enum(['full', 'half', 'inset']).default('full'),
        }),
      )
      .default([]),
  }),
});

export const collections = { projects };
