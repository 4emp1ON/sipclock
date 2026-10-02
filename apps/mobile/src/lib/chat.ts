import { recipesById } from '@sipclock/catalog';
import type { Locale } from '@sipclock/i18n';

import { type AiDeps, AiError, type AiErrorKind } from './ai';

export type ChatRole = 'user' | 'assistant';
export interface ChatLine {
  role: ChatRole;
  text: string;
}

export type ChatRecipeStatus = 'ready' | 'swap' | 'missing' | 'unknown';
export interface ChatRecipe {
  id: string;
  name: string;
  abv: number;
  status: ChatRecipeStatus;
  missing: string[];
}
export interface ChatTool {
  tool: string;
  recipes: ChatRecipe[];
}
export interface ChatAnswer {
  text: string;
  tools: ChatTool[];
  /** From `X-AI-Quota-Remaining`; null when absent. */
  quotaRemaining: number | null;
}

/** Why a chat request failed, beyond the generic `AiErrorKind`. */
export type ChatErrorKind = 'unauthorized' | 'busy' | 'quota' | 'failed';

export const CHAT_TIMEOUT_MS = 60_000;
export const MAX_CHAT_LINES = 20;
export const MAX_LINE_CHARS = 2000;
export const MAX_QUESTION_CHARS = 500;
export const MAX_CARDS_PER_TOOL = 3;

const STATUSES: readonly string[] = ['ready', 'swap', 'missing', 'unknown'];

/** The device's local time as ISO 8601 with its UTC offset, e.g. `2026-10-02T19:05:00+03:00`. */
export function localIsoTime(date: Date): string {
  const p = (n: number, w = 2) => String(Math.abs(n)).padStart(w, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset < 0 ? '-' : '+';
  return (
    `${p(date.getFullYear(), 4)}-${p(date.getMonth() + 1)}-${p(date.getDate())}` +
    `T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}` +
    `${sign}${p(Math.floor(Math.abs(offset) / 60))}:${p(Math.abs(offset) % 60)}`
  );
}

/** Last 20 lines, each cut to 2000 chars, the final question to 500; empty lines are dropped. */
export function trimHistory(lines: readonly ChatLine[]): ChatLine[] {
  const kept = lines
    .map((l) => ({ role: l.role, text: l.text.trim() }))
    .filter((l) => l.text !== '')
    .slice(-MAX_CHAT_LINES);
  return kept.map((l, i) => ({
    role: l.role,
    text: l.text.slice(
      0,
      i === kept.length - 1 && l.role === 'user' ? MAX_QUESTION_CHARS : MAX_LINE_CHARS,
    ),
  }));
}

function parseRecipe(raw: unknown): ChatRecipe | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !recipesById.has(r.id)) return null;
  if (typeof r.name !== 'string') return null;
  if (typeof r.abv !== 'number' || !Number.isFinite(r.abv)) return null;
  if (typeof r.status !== 'string' || !STATUSES.includes(r.status)) return null;
  if (!Array.isArray(r.missing) || !r.missing.every((m) => typeof m === 'string')) return null;
  return {
    id: r.id,
    name: r.name,
    abv: r.abv,
    status: r.status as ChatRecipeStatus,
    missing: r.missing as string[],
  };
}

/** Defensive parse: malformed recipes and ids outside the catalog are dropped, at most 3 cards per tool. */
export function parseChatBody(body: unknown): { text: string; tools: ChatTool[] } {
  if (typeof body !== 'object' || body === null) throw new Error('bad body');
  const b = body as Record<string, unknown>;
  if (typeof b.text !== 'string') throw new Error('no text');
  const tools: ChatTool[] = [];
  if (Array.isArray(b.tools)) {
    for (const raw of b.tools) {
      if (typeof raw !== 'object' || raw === null) continue;
      const t = raw as Record<string, unknown>;
      if (typeof t.tool !== 'string') continue;
      const recipes = (Array.isArray(t.recipes) ? t.recipes : [])
        .flatMap((r) => parseRecipe(r) ?? [])
        .slice(0, MAX_CARDS_PER_TOOL);
      tools.push({ tool: t.tool, recipes });
    }
  }
  return { text: b.text, tools };
}

function kindForChatStatus(status: number, quotaHeader: string | null): AiErrorKind {
  if (status === 401) return 'unauthorized';
  // 429 with an exhausted quota is the daily limit; any other 429 is plain rate limiting.
  if (status === 429) return quotaHeader?.trim() === '0' ? 'rate_limited' : 'server';
  if (status >= 400 && status < 500) return 'invalid';
  return 'server';
}

/** Maps a thrown error to what the screen shows. */
export function chatErrorKind(e: unknown): ChatErrorKind {
  if (!(e instanceof AiError)) return 'failed';
  if (e.kind === 'unauthorized') return 'unauthorized';
  if (e.kind === 'rate_limited') return 'quota';
  if (e.status === 409) return 'busy';
  return 'failed';
}

async function problemText(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown; title?: unknown };
    for (const v of [body.detail, body.title]) if (typeof v === 'string' && v) return v;
  } catch {
    // Not JSON: the status is enough.
  }
  return `request failed: ${res.status}`;
}

/**
 * `POST /v1/ai/chat` (non-streaming JSON). Throws `AiError`: 'unauthorized' (401), 'rate_limited' (daily
 * limit: 429 with quota 0), status 409 for an answer still in progress, otherwise 'server' / 'network'.
 */
export async function sendChat(
  deps: AiDeps,
  req: { messages: readonly ChatLine[]; locale: Locale; now?: Date },
): Promise<ChatAnswer> {
  const cookie = await deps.getCookie();
  if (!cookie) throw new AiError('unauthorized', null, 'not signed in');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? CHAT_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await (deps.fetch ?? fetch)(`${deps.apiUrl}/v1/ai/chat`, {
        method: 'POST',
        credentials: 'omit',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Cookie: cookie },
        body: JSON.stringify({
          messages: trimHistory(req.messages),
          locale: req.locale,
          clientTime: localIsoTime(req.now ?? new Date()),
        }),
      });
    } catch (e) {
      throw new AiError('network', null, e instanceof Error ? e.message : 'network error');
    }
    const header = res.headers.get('X-AI-Quota-Remaining');
    if (!res.ok)
      throw new AiError(kindForChatStatus(res.status, header), res.status, await problemText(res));

    try {
      const parsed = parseChatBody(await res.json());
      const quota = header === null || header.trim() === '' ? Number.NaN : Number(header);
      return { ...parsed, quotaRemaining: Number.isFinite(quota) ? quota : null };
    } catch {
      throw new AiError('server', res.status, 'unreadable response');
    }
  } finally {
    clearTimeout(timer);
  }
}
