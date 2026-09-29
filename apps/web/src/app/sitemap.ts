import type { MetadataRoute } from 'next';
import { recipes } from '@/data/recipes';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
    ...recipes.map((r) => ({
      url: `${SITE_URL}/recipes/${r.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
