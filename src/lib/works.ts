import { getCollection, type CollectionEntry } from 'astro:content';

export type Work = CollectionEntry<'works'>;

// Newest first by yearMonth; works without a date go last, then by title.
function compareWorks(a: Work, b: Work) {
  const ya = a.data.yearMonth ?? '';
  const yb = b.data.yearMonth ?? '';
  if (ya !== yb) return yb.localeCompare(ya);
  return a.data.title.localeCompare(b.data.title);
}

export async function getWorks(): Promise<Work[]> {
  const works = await getCollection('works', ({ data }) => data.published);
  return works.sort(compareWorks);
}

export function workYear(work: Work): string | undefined {
  return work.data.yearMonth?.slice(0, 4);
}

// Previous / next wrap around so every project shows both links.
export function neighbours(works: Work[], id: string) {
  const i = works.findIndex((w) => w.id === id);
  const n = works.length;
  if (i === -1 || n < 2) return { previous: undefined, next: undefined };
  return { previous: works[(i - 1 + n) % n], next: works[(i + 1) % n] };
}
