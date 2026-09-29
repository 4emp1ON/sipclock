import type { MetadataRoute } from 'next';
import { LOCALES } from '@/i18n/ui';
import { catalog } from '@/lib/catalog';
import { SITE_URL } from '@/lib/site';

function entry(path: string, changeFrequency: 'weekly' | 'monthly', priority: number) {
  const languages = Object.fromEntries(LOCALES.map((l) => [l, `${SITE_URL}/${l}${path}`]));
  return LOCALES.map((l) => ({
    url: `${SITE_URL}/${l}${path}`,
    changeFrequency,
    priority,
    alternates: { languages },
  }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...entry('', 'weekly', 1),
    ...entry('/recipes', 'weekly', 0.8),
    ...catalog.recipes.flatMap((r) => entry(`/recipes/${r.id}`, 'monthly', 0.7)),
  ];
}
