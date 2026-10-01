import { ingredientsById } from '@sipclock/catalog';
import { glassLabel, methodLabel } from '@sipclock/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AbvBadge } from '@/components/abv-badge';
import { IngredientList } from '@/components/ingredient-list';
import { RecipeActions } from '@/components/recipe-actions';
import { SwapFinder } from '@/components/swap-finder';
import { getUi, isLocale, LOCALES } from '@/i18n/ui';
import {
  catalog,
  ingredientName,
  partsBase,
  recipeAbv,
  recipeName,
  recipesById,
  relatedRecipes,
} from '@/lib/catalog';
import { buildRecipeJsonLd, recipePath, serializeJsonLd } from '@/lib/recipe-jsonld';
import { alternatesFor } from '@/lib/seo';
import { SITE_URL } from '@/lib/site';

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => catalog.recipes.map((r) => ({ locale, slug: r.id })));
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/recipes/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  const recipe = recipesById.get(slug);
  if (!isLocale(locale) || !recipe) return {};
  const ui = getUi(locale);
  const title = ui.recipes.metaTitle(recipe.name[locale]);
  const description = recipe.description[locale];
  return {
    title,
    description,
    alternates: alternatesFor(locale, `/recipes/${recipe.id}`),
    openGraph: {
      type: 'article',
      title: `${title} | Sipclock`,
      description,
      url: recipePath(locale, recipe.id),
      siteName: 'Sipclock',
      locale: locale === 'ru' ? 'ru_RU' : 'en_US',
    },
  };
}

export default async function RecipePage({ params }: PageProps<'/[locale]/recipes/[slug]'>) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const recipe = recipesById.get(slug);
  if (!recipe) notFound();
  const ui = getUi(locale);
  const twin = recipe.zeroProofTwin ? recipesById.get(recipe.zeroProofTwin) : undefined;
  const related = relatedRecipes(recipe);

  return (
    <div>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD, `<` escaped in serializer
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildRecipeJsonLd(recipe, locale, SITE_URL)),
        }}
      />
      <article className="max-w-2xl">
        <p className="text-sm text-ink-muted">
          {glassLabel[locale][recipe.glass]} · {methodLabel[locale][recipe.method]}
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold leading-tight">
          {recipe.name[locale]}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
          <AbvBadge abv={recipeAbv(recipe)} labels={ui.abv} />
          <span className="tabular">
            {recipe.timeMinutes} {ui.recipes.min}
          </span>
          <span>{ui.recipes.difficulty[recipe.difficulty]}</span>
        </div>
        <p className="mt-6 text-lg">{recipe.description[locale]}</p>
        <RecipeActions recipeId={recipe.id} locale={locale} />

        <h2 className="mt-10 font-display text-xl font-semibold">{ui.recipes.ingredients}</h2>
        <IngredientList
          locale={locale}
          partsBase={partsBase(recipe)}
          rows={recipe.ingredients.map((i) => ({
            id: i.ingredient,
            name: ingredientName(i.ingredient, locale),
            amount: i.amount,
            optional: i.optional,
            garnish: i.garnish,
          }))}
          labels={{
            units: ui.recipes.units,
            servings: ui.recipes.servings,
            ml: ui.recipes.ml,
            oz: ui.recipes.oz,
            parts: ui.recipes.parts,
            optional: ui.recipes.optional,
            garnish: ui.recipes.garnish,
          }}
        />
        <SwapFinder
          recipeId={recipe.id}
          locale={locale}
          ingredientIds={recipe.ingredients
            // Staples (ice, water) are in every bar: nothing to swap.
            .filter((i) => !i.garnish && ingredientsById.get(i.ingredient)?.staple !== true)
            .map((i) => i.ingredient)}
        />

        <h2 className="mt-10 font-display text-xl font-semibold">{ui.recipes.steps}</h2>
        <ol className="mt-4 flex flex-col gap-4">
          {recipe.steps.map((s, idx) => (
            <li key={s.en} className="flex gap-4">
              <span className="tabular flex size-8 shrink-0 items-center justify-center rounded-pill bg-primary font-semibold text-on-primary">
                {idx + 1}
              </span>
              <span className="pt-1">{s[locale]}</span>
            </li>
          ))}
        </ol>

        {twin && (
          <p className="mt-10">
            <Link
              href={`/${locale}/recipes/${twin.id}`}
              className="inline-flex min-h-12 items-center rounded-pill bg-mint px-6 font-semibold text-on-mint"
            >
              {ui.recipes.zeroProofTwin}: {twin.name[locale]}
            </Link>
          </p>
        )}
      </article>

      {related.length > 0 && (
        <section aria-labelledby="related" className="mt-14">
          <h2 id="related" className="font-display text-xl font-semibold">
            {ui.recipes.related}
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/${locale}/recipes/${r.id}`}
                  className="flex min-h-11 h-full items-center rounded-md bg-surface p-4 font-semibold hover:bg-surface-raised"
                >
                  {recipeName(r.id, locale)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
