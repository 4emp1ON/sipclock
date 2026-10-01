// Assertions shared by the suite (promptfoo `file://asserts.ts:<export>`). `output` is the provider's JSON.
import { matchesLocale, mentionsBrand } from '../../src/ai/guard.ts';

interface Suggestion {
  ingredientId: string;
  inBar: boolean;
  fit: 'close' | 'workable';
  note?: string;
}
interface Answer {
  source: 'ai' | 'catalog';
  suggestions: Suggestion[];
  canSkip: boolean;
  candidates: string[];
}
interface Context {
  vars: Record<string, unknown>;
}
type Result = { pass: boolean; score: number; reason: string };

const parse = (output: string) => JSON.parse(output) as Answer;
const result = (pass: boolean, reason: string): Result => ({ pass, score: pass ? 1 : 0, reason });

export function sourceIsAi(output: string): Result {
  const { source } = parse(output);
  return result(source === 'ai', `source is ${source}`);
}

export function hasSuggestion(output: string): Result {
  const { suggestions } = parse(output);
  return result(suggestions.length > 0, `${suggestions.length} suggestions`);
}

export function idsAreCandidates(output: string): Result {
  const { suggestions, candidates } = parse(output);
  const bad = suggestions.filter((s) => !candidates.includes(s.ingredientId));
  return result(bad.length === 0, `not candidates: ${bad.map((s) => s.ingredientId).join(', ')}`);
}

export function notesAreClean(output: string, context: Context): Result {
  const { suggestions } = parse(output);
  const locale = context.vars.locale === 'ru' ? 'ru' : 'en';
  const problems: string[] = [];
  for (const s of suggestions) {
    const note = s.note ?? '';
    if (note.length > 160) problems.push(`${s.ingredientId}: ${note.length} chars`);
    if (mentionsBrand(note)) problems.push(`${s.ingredientId}: brand`);
    if (!matchesLocale(note, locale)) problems.push(`${s.ingredientId}: not ${locale}`);
  }
  return result(problems.length === 0, problems.join('; '));
}

/** Case-specific: `config.first` = acceptable first ids. */
export function firstIsOneOf(output: string, context: { config?: { ids?: string[] } }): Result {
  const ids = context.config?.ids ?? [];
  const first = parse(output).suggestions[0]?.ingredientId;
  return result(
    first !== undefined && ids.includes(first),
    `first is ${first}, want ${ids.join(' | ')}`,
  );
}

/** Case-specific: `config.ids` must all appear, or any when `config.any` is set. */
export function includesAny(output: string, context: { config?: { ids?: string[] } }): Result {
  const ids = context.config?.ids ?? [];
  const got = parse(output).suggestions.map((s) => s.ingredientId);
  return result(
    ids.some((id) => got.includes(id)),
    `got ${got.join(', ')}, want one of ${ids.join(', ')}`,
  );
}

/** If `config.id` is suggested, its fit must be `config.fit`; absent passes. */
export function fitIs(output: string, context: { config?: { id?: string; fit?: string } }): Result {
  const { id, fit } = context.config ?? {};
  const found = parse(output).suggestions.find((s) => s.ingredientId === id);
  if (!found) return result(true, `${id} not suggested`);
  return result(found.fit === fit, `${id} fit is ${found.fit}, want ${fit}`);
}

export function firstIsWithFit(
  output: string,
  context: { config?: { id?: string; fit?: string } },
): Result {
  const { id, fit } = context.config ?? {};
  const first = parse(output).suggestions[0];
  return result(
    first?.ingredientId === id && first?.fit === fit,
    `first is ${first?.ingredientId}/${first?.fit}, want ${id}/${fit}`,
  );
}

export function canSkipIs(output: string, context: { config?: { value?: boolean } }): Result {
  const { canSkip } = parse(output);
  return result(canSkip === context.config?.value, `canSkip is ${canSkip}`);
}
