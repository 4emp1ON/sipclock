import { glassLabel, methodLabel, occasionLabel } from '@sipclock/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RecipeBrowser, type RecipeCard } from '@/components/recipe-browser';
import { getUi, isLocale, LOCALES } from '@/i18n/ui';
import { catalog, recipeAbv } from '@/lib/catalog';
import { alternatesFor } from '@/lib/seo';

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/recipes'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const ui = getUi(locale);
  return {
    title: ui.recipes.title,
    description: ui.recipes.description,
    alternates: alternatesFor(locale, '/recipes'),
  };
}

export default async function RecipesPage({ params }: PageProps<'/[locale]/recipes'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ui = getUi(locale);

  const cards: RecipeCard[] = catalog.recipes
    .map((r) => ({
      id: r.id,
      name: r.name[locale],
      kind: `${glassLabel[locale][r.glass]} · ${methodLabel[locale][r.method]}`,
      glass: r.glass,
      glassLabel: glassLabel[locale][r.glass],
      abv: recipeAbv(r),
      occasions: r.tags.occasions,
      minutes: r.timeMinutes,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold leading-tight">{ui.recipes.title}</h1>
      <p className="mt-3 max-w-2xl text-ink-muted">{ui.recipes.description}</p>
      <div className="mt-8">
        <RecipeBrowser
          locale={locale}
          cards={cards}
          labels={{
            all: ui.recipes.all,
            alcoholFree: ui.recipes.alcoholFree,
            filters: ui.recipes.filters,
            empty: ui.recipes.empty,
            search: ui.recipes.search,
            min: ui.recipes.min,
            abv: ui.abv,
            count: ui.recipes.countTemplate,
            occasions: (Object.keys(occasionLabel.en) as (keyof typeof occasionLabel.en)[]).map(
              (id) => ({ id, label: occasionLabel[locale][id] }),
            ),
          }}
        />
      </div>
    </div>
  );
}
