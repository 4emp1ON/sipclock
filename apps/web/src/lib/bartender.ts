// Pure helpers for the Bartender chat (POST /api/ai/chat, proxied to /v1/ai/chat).
import { z } from 'zod';

export const MAX_INPUT = 500;
export const MAX_MESSAGE = 2000;
export const MAX_HISTORY = 20;
export const MAX_CARDS = 3;
/** Daily AI questions per user; mirrors the API quota, used for the limit notice copy. */
export const DAILY_LIMIT = 15;

export const TOOL_NAMES = [
  'get_my_bar',
  'what_can_i_make',
  'search_recipes',
  'get_recipe',
  'find_substitutes',
  'recommend_now',
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export function isToolName(value: string): value is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(value);
}

/** `tool-get_my_bar` -> `get_my_bar`; null for anything that is not one of our tool parts. */
export function toolNameOfPart(partType: string): ToolName | null {
  if (!partType.startsWith('tool-')) return null;
  const name = partType.slice('tool-'.length);
  return isToolName(name) ? name : null;
}

// ---- request ----

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface ChatRequestBody {
  messages: ChatTurn[];
  locale: 'en' | 'ru';
  clientTime: string;
}

interface MessageLike {
  role: string;
  parts: ReadonlyArray<{ type: string; text?: string }>;
}

/**
 * UI messages -> `{ role, text }`: text parts joined, tool parts dropped, empty messages dropped,
 * each text capped, the last 20 kept and the final user text capped at MAX_INPUT.
 */
export function flattenMessages(messages: readonly MessageLike[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    const text = m.parts
      .filter((p) => p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text)
      .join('')
      .trim();
    if (!text) continue;
    turns.push({ role: m.role, text: text.slice(0, MAX_MESSAGE) });
  }
  const kept = turns.slice(-MAX_HISTORY);
  const last = kept[kept.length - 1];
  if (last?.role === 'user') last.text = last.text.slice(0, MAX_INPUT);
  return kept;
}

/** Local time as ISO 8601 with the UTC offset, e.g. 2026-10-01T19:05:00+03:00. */
export function isoWithOffset(date: Date): string {
  const pad = (n: number, width = 2) => String(Math.trunc(Math.abs(n))).padStart(width, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  return (
    `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(offset / 60)}:${pad(offset % 60)}`
  );
}

export function buildChatBody(
  messages: readonly MessageLike[],
  locale: 'en' | 'ru',
  now: Date,
): ChatRequestBody {
  return { messages: flattenMessages(messages), locale, clientTime: isoWithOffset(now) };
}

// ---- errors and quota ----

export type ChatErrorKind = 'unauthorized' | 'busy' | 'limit' | 'failed';

/** Integer from `X-AI-Quota-Remaining`, or null when absent or malformed. */
export function parseQuota(header: string | null): number | null {
  if (header === null || !/^\s*\d{1,6}\s*$/.test(header)) return null;
  return Number(header);
}

/** 429 with quota 0 is the daily limit; any other 429 is plain rate limiting (generic failure). */
export function classifyChatError(status: number, quotaHeader: string | null): ChatErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 409) return 'busy';
  if (status === 429 && parseQuota(quotaHeader) === 0) return 'limit';
  return 'failed';
}

export class ChatApiError extends Error {
  readonly kind: ChatErrorKind;
  constructor(kind: ChatErrorKind) {
    super(`chat request failed: ${kind}`);
    this.name = 'ChatApiError';
    this.kind = kind;
  }
}

export function errorKind(error: unknown): ChatErrorKind {
  return error instanceof ChatApiError ? error.kind : 'failed';
}

/**
 * Wraps fetch for the chat transport: reports the quota header of every response and turns
 * non-2xx responses into ChatApiError before the SDK tries to parse them as a stream.
 */
export function createChatFetch(
  base: typeof fetch,
  onQuota: (remaining: number) => void,
): typeof fetch {
  return async (input, init) => {
    const res = await base(input, init);
    const header = res.headers.get('x-ai-quota-remaining');
    const quota = parseQuota(header);
    if (quota !== null) onQuota(quota);
    if (!res.ok) throw new ChatApiError(classifyChatError(res.status, header));
    return res;
  };
}

// ---- tool outputs ----

export interface CardRecipe {
  id: string;
  name: string;
  abv: number;
  status: 'ready' | 'swap' | 'missing' | 'unknown';
  missing: string[];
}

const recipeSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,80}$/),
  name: z.string().min(1).max(200),
  abv: z.number().min(0).max(100),
  status: z.enum(['ready', 'swap', 'missing', 'unknown']),
  missing: z.array(z.string().max(200)).max(50).catch([]),
});

/**
 * Recipe cards from an untrusted tool output: anything but `{ recipes: [...] }` yields nothing,
 * invalid items are skipped, extra fields ignored. `isKnown` drops ids the site has no page for.
 */
export function parseToolRecipes(
  output: unknown,
  isKnown: (id: string) => boolean = () => true,
  max = MAX_CARDS,
): CardRecipe[] {
  if (typeof output !== 'object' || output === null) return [];
  const list = (output as { recipes?: unknown }).recipes;
  if (!Array.isArray(list)) return [];
  const cards: CardRecipe[] = [];
  for (const item of list) {
    if (cards.length >= max) break;
    const parsed = recipeSchema.safeParse(item);
    if (parsed.success && isKnown(parsed.data.id)) cards.push(parsed.data);
  }
  return cards;
}

// ---- copy helpers ----

/** Remaining-question text; null while unknown (before the first response). */
export function quotaText(
  remaining: number | null,
  ui: { left: (n: number) => string; none: string },
): string | null {
  if (remaining === null) return null;
  return remaining <= 0 ? ui.none : ui.left(remaining);
}
