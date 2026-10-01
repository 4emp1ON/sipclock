// Assertions for the chat suite (promptfoo `file://asserts.ts:<export>`). `output` is the provider's JSON.
import { createIndex, estimateAbv, isAlcoholFree } from '@sipclock/engine';
import { matchesLocale, mentionsBrand } from '../../src/ai/guard.ts';
import { createBundledCatalogService } from '../../src/services/catalog.ts';

interface Answer {
  tools: string[];
  recipes: string[];
  text: string;
}
type Result = { pass: boolean; score: number; reason: string };
type Ctx = { vars: Record<string, unknown>; config?: Record<string, unknown> };

const parse = (output: string) => JSON.parse(output) as Answer;
const result = (pass: boolean, reason: string): Result => ({ pass, score: pass ? 1 : 0, reason });
const index = createIndex(createBundledCatalogService(process.env.CATALOG_DIR).catalog);

export function textIsClean(output: string, context: Ctx): Result {
  const { text } = parse(output);
  const locale = context.vars.locale === 'ru' ? 'ru' : 'en';
  const problems: string[] = [];
  if (text.length === 0) problems.push('empty text');
  if (!matchesLocale(text, locale)) problems.push(`not ${locale}`);
  if (mentionsBrand(text)) problems.push('brand');
  if (/^\s*[-*•]\s/m.test(text)) problems.push('list line');
  if (/https?:\/\/|www\.|\]\(/i.test(text)) problems.push('link');
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words > 120) problems.push(`${words} words`);
  return result(problems.length === 0, problems.join('; ') || 'ok');
}

export function recipesExist(output: string): Result {
  const bad = parse(output).recipes.filter((id) => !index.recipes.has(id));
  return result(bad.length === 0, `unknown recipes: ${bad.join(', ')}`);
}

/** `config.any`: at least one of these tools was called. */
export function toolsIncludeAny(output: string, context: Ctx): Result {
  const want = (context.config?.any ?? []) as string[];
  const { tools } = parse(output);
  return result(
    want.some((t) => tools.includes(t)),
    `tools: ${tools.join(', ') || 'none'}; want ${want.join(' | ')}`,
  );
}

export function noTools(output: string): Result {
  const { tools } = parse(output);
  return result(tools.length === 0, `tools: ${tools.join(', ')}`);
}

/** `config.id`: this recipe was returned by a tool. */
export function recipesInclude(output: string, context: Ctx): Result {
  const id = String(context.config?.id);
  const { recipes } = parse(output);
  return result(recipes.includes(id), `recipes: ${recipes.join(', ')}; want ${id}`);
}

/** `config.words`: none of these substrings (case-insensitive) in the text. */
export function textLacks(output: string, context: Ctx): Result {
  const words = (context.config?.words ?? []) as string[];
  const text = parse(output).text.toLowerCase();
  const found = words.filter((w) => text.includes(w.toLowerCase()));
  return result(found.length === 0, `text contains: ${found.join(', ')}`);
}

export function someRecipeIsAlcoholFree(output: string): Result {
  const { recipes } = parse(output);
  const free = recipes.filter((id) => {
    const r = index.recipes.get(id);
    return r !== undefined && (isAlcoholFree(r, index) || estimateAbv(r, index) === 0);
  });
  return result(free.length > 0, `recipes: ${recipes.join(', ') || 'none'}`);
}

export function brandFree(output: string): Result {
  return result(!mentionsBrand(parse(output).text), 'brand in text');
}
