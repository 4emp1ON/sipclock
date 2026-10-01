import { describe, expect, it, vi } from 'vitest';
import {
  buildChatBody,
  ChatApiError,
  classifyChatError,
  createChatFetch,
  errorKind,
  flattenMessages,
  isoWithOffset,
  parseQuota,
  parseToolRecipes,
  quotaText,
  toolNameOfPart,
} from './bartender';

const msg = (role: string, ...texts: string[]) => ({
  role,
  parts: texts.map((text) => ({ type: 'text', text })),
});

describe('flattenMessages', () => {
  it('joins text parts, drops tool parts and empty assistant messages', () => {
    const out = flattenMessages([
      msg('user', 'Hi'),
      {
        role: 'assistant',
        parts: [
          { type: 'tool-get_my_bar' },
          { type: 'text', text: 'A' },
          { type: 'text', text: 'B' },
        ],
      },
      { role: 'assistant', parts: [{ type: 'tool-get_my_bar' }] },
      msg('assistant', '   '),
      msg('user', 'More'),
    ]);
    expect(out).toEqual([
      { role: 'user', text: 'Hi' },
      { role: 'assistant', text: 'AB' },
      { role: 'user', text: 'More' },
    ]);
  });
  it('keeps the last 20, caps texts at 2000 and the final user text at 500', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      msg(i % 2 === 0 ? 'user' : 'assistant', `m${i}`),
    );
    many.push(msg('user', 'x'.repeat(900)));
    const out = flattenMessages(many);
    expect(out).toHaveLength(20);
    expect(out[19]?.text).toHaveLength(500);
    expect(
      flattenMessages([msg('assistant', 'y'.repeat(5000)), msg('user', 'q')])[0]?.text,
    ).toHaveLength(2000);
  });
});

describe('isoWithOffset', () => {
  it('matches the ISO 8601 offset format and the instant', () => {
    const d = new Date('2026-10-01T16:05:00Z');
    const s = isoWithOffset(d);
    expect(s).toMatch(/^2026-10-0[12]T\d{2}:05:00[+-]\d{2}:\d{2}$/);
    expect(new Date(s).getTime()).toBe(d.getTime());
  });
});

describe('buildChatBody', () => {
  it('has messages, locale and clientTime', () => {
    const body = buildChatBody([msg('user', 'Hi')], 'ru', new Date());
    expect(Object.keys(body).sort()).toEqual(['clientTime', 'locale', 'messages']);
    expect(body.locale).toBe('ru');
  });
});

describe('errors and quota', () => {
  it('parses the quota header', () => {
    expect(parseQuota('13')).toBe(13);
    expect(parseQuota('0')).toBe(0);
    expect(parseQuota(null)).toBeNull();
    expect(parseQuota('-1')).toBeNull();
    expect(parseQuota('abc')).toBeNull();
  });
  it('maps status and quota to an error kind', () => {
    expect(classifyChatError(401, null)).toBe('unauthorized');
    expect(classifyChatError(409, null)).toBe('busy');
    expect(classifyChatError(429, '0')).toBe('limit');
    expect(classifyChatError(429, null)).toBe('failed');
    expect(classifyChatError(429, '3')).toBe('failed');
    expect(classifyChatError(503, null)).toBe('failed');
    expect(classifyChatError(500, '0')).toBe('failed');
  });
  it('errorKind falls back to failed', () => {
    expect(errorKind(new ChatApiError('limit'))).toBe('limit');
    expect(errorKind(new Error('net'))).toBe('failed');
    expect(errorKind(undefined)).toBe('failed');
  });
  it('createChatFetch reports quota and throws typed errors', async () => {
    const onQuota = vi.fn();
    const ok = createChatFetch(
      vi.fn(async () => new Response('x', { headers: { 'x-ai-quota-remaining': '12' } })),
      onQuota,
    );
    await ok('/api/ai/chat');
    expect(onQuota).toHaveBeenCalledWith(12);

    const limit = createChatFetch(
      vi.fn(
        async () => new Response('{}', { status: 429, headers: { 'x-ai-quota-remaining': '0' } }),
      ),
      onQuota,
    );
    await expect(limit('/api/ai/chat')).rejects.toMatchObject({ kind: 'limit' });
    expect(onQuota).toHaveBeenLastCalledWith(0);

    const busy = createChatFetch(
      vi.fn(async () => new Response('{}', { status: 409 })),
      onQuota,
    );
    await expect(busy('/api/ai/chat')).rejects.toMatchObject({ kind: 'busy' });
  });
});

describe('quotaText', () => {
  const ui = { left: (n: number) => `${n} left`, none: 'none' };
  it('formats remaining questions', () => {
    expect(quotaText(null, ui)).toBeNull();
    expect(quotaText(13, ui)).toBe('13 left');
    expect(quotaText(0, ui)).toBe('none');
  });
});

describe('toolNameOfPart', () => {
  it('accepts only known tool parts', () => {
    expect(toolNameOfPart('tool-get_my_bar')).toBe('get_my_bar');
    expect(toolNameOfPart('tool-rm_rf')).toBeNull();
    expect(toolNameOfPart('text')).toBeNull();
    expect(toolNameOfPart('dynamic-tool')).toBeNull();
  });
});

describe('parseToolRecipes', () => {
  const good = { id: 'negroni', name: 'Negroni', abv: 24, status: 'ready', missing: [] };
  it('parses valid items, ignores extra fields and caps at 3', () => {
    const out = parseToolRecipes({
      note: 'ignored',
      recipes: [
        { ...good, extra: 1 },
        { ...good, id: 'a' },
        { ...good, id: 'b' },
        { ...good, id: 'c' },
      ],
    });
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual(good);
  });
  it('skips invalid items and defaults bad missing lists', () => {
    const out = parseToolRecipes({
      recipes: [
        { ...good, abv: 'x' },
        { ...good, id: '../evil' },
        { ...good, status: 'weird' },
        null,
        { ...good, id: 'ok', missing: 'nope' },
      ],
    });
    expect(out).toEqual([{ ...good, id: 'ok', missing: [] }]);
  });
  it('returns nothing for non-objects and missing lists', () => {
    expect(parseToolRecipes(null)).toEqual([]);
    expect(parseToolRecipes('x')).toEqual([]);
    expect(parseToolRecipes({ recipes: 'x' })).toEqual([]);
    expect(parseToolRecipes({})).toEqual([]);
  });
  it('drops unknown ids when a filter is given', () => {
    expect(parseToolRecipes({ recipes: [good] }, () => false)).toEqual([]);
  });
});
