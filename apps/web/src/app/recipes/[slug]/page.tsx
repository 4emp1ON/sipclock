import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AbvBadge } from '@/components/abv-badge';
import { Logo } from '@/components/logo';
import { SiteFooter } from '@/components/site-footer';
import { getRecipe, recipes } from '@/data/recipes';
import { buildRecipeJsonLd, serializeJsonLd } from '@/lib/recipe-jsonld';
import { SITE_URL } from '@/lib/site';

export const dynamicParams = false;

export function generateStaticParams() {
  return recipes.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<'/recipes/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const recipe = getRecipe(slug);
  if (!recipe) return {};
  const title = `${recipe.name} recipe`;
  const url = `/recipes/${recipe.slug}`;
  return {
    title,
    description: recipe.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: `${title} | Sipclock`,
      description: recipe.description,
      url,
      siteName: 'Sipclock',
    },
  };
}

export default async function RecipePage({ params }: PageProps<'/recipes/[slug]'>) {
  const { slug } = await params;
  const recipe = getRecipe(slug);
  if (!recipe) notFound();

  return (
    <>
      <header className="mx-auto flex w-full max-w-[1200px] items-center px-5 py-2">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 py-8 md:py-12">
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD, `<` escaped in serializer
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(buildRecipeJsonLd(recipe, SITE_URL)),
          }}
        />
        <article className="max-w-2xl">
          <p className="text-sm text-ink-muted">
            {recipe.kind} · {recipe.profile}
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold leading-tight">{recipe.name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
            <AbvBadge abv={recipe.abv} />
            <span className="tabular">{recipe.minutes} min</span>
            <span className="capitalize">{recipe.difficulty}</span>
            <span>{recipe.glass}</span>
          </div>
          <p className="mt-6 text-lg">{recipe.description}</p>

          <h2 className="mt-10 font-display text-xl font-semibold">Ingredients</h2>
          <ul className="mt-4 divide-y divide-line rounded-md bg-surface">
            {recipe.ingredients.map((i) => (
              <li key={i.name} className="flex justify-between gap-4 px-4 py-3">
                <span>{i.name}</span>
                <span className="tabular text-ink-muted">{i.amount}</span>
              </li>
            ))}
          </ul>

          <h2 className="mt-10 font-display text-xl font-semibold">Steps</h2>
          <ol className="mt-4 flex flex-col gap-4">
            {recipe.steps.map((s, idx) => (
              <li key={s} className="flex gap-4">
                <span className="tabular flex size-8 shrink-0 items-center justify-center rounded-pill bg-primary font-semibold text-on-primary">
                  {idx + 1}
                </span>
                <span className="pt-1">{s}</span>
              </li>
            ))}
          </ol>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
