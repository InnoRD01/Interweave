import { getCollection, type CollectionEntry } from 'astro:content';

export type Project = CollectionEntry<'projects'>;

export const STATUS_LABEL: Record<Project['data']['status'], string> = {
  built: 'Built',
  construction: 'Under construction',
  design: 'In design',
  unbuilt: 'Unbuilt',
};

export const TYPOLOGY_LABEL: Record<Project['data']['typology'], string> = {
  residential: 'Residential',
  hospitality: 'Hospitality',
  institutional: 'Institutional',
  cultural: 'Cultural',
  commercial: 'Commercial',
  interiors: 'Interiors',
  landscape: 'Landscape & urban',
};

/** Explicit order first, then newest first. */
export async function getProjects(): Promise<Project[]> {
  const all = await getCollection('projects');
  return all.sort((a, b) => {
    const ao = a.data.order ?? Infinity;
    const bo = b.data.order ?? Infinity;
    if (ao !== bo) return ao - bo;
    return (b.data.yearEnd ?? b.data.yearStart ?? 9999) - (a.data.yearEnd ?? a.data.yearStart ?? 9999);
  });
}

export function yearLabel(p: Project): string {
  const { yearStart: s, yearEnd: e } = p.data;
  if (s && e && s !== e) return `${s}–${e}`;
  if (e) return String(e);
  if (s) return `${s}–`;
  return '';
}
