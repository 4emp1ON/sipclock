import { catalog } from '@sipclock/catalog';

import { AiError } from './ai';
import { chatErrorKind, localIsoTime, sendChat, trimHistory } from './chat';

const recipes = catalog.recipes;
const id = recipes[0].id;
const recipe = { id, name: 'Negroni', abv: 24, status: 'missing', missing: ['campari'] };
const deps = (fetchImpl: unknown, cookie = 'sid=1') => ({
  apiUrl: 'https://api.test',
  getCookie: async () => cookie,
  fetch: fetchImpl as typeof fetch,
});
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers });
const messages = [{ role: 'user' as const, text: 'What can I make?' }];
const send = (f: unknown) => sendChat(deps(f), { messages, locale: 'en' });

describe('sendChat', () => {
  it('sends the request and parses the answer with quota', async () => {
    const f = jest.fn(async () =>
      json({ text: 'Hi', tools: [{ tool: 'get_my_bar', recipes: [recipe] }] }, 200, {
        'X-AI-Quota-Remaining': '12',
      }),
    );
    const out = await sendChat(deps(f), {
      messages,
      locale: 'ru',
      now: new Date(2026, 9, 2, 19, 5, 7),
    });
    expect(out).toEqual({
      text: 'Hi',
      tools: [{ tool: 'get_my_bar', recipes: [recipe] }],
      quotaRemaining: 12,
    });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.test/v1/ai/chat');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Cookie: 'sid=1',
    });
    const body = JSON.parse(init.body as string);
    expect(body.messages).toEqual(messages);
    expect(body.locale).toBe('ru');
    expect(body.clientTime).toMatch(/^2026-10-02T19:05:07[+-]\d{2}:\d{2}$/);
  });

  it('has null quota without the header', async () => {
    expect((await send(async () => json({ text: 'Hi', tools: [] }))).quotaRemaining).toBeNull();
  });

  it('fails as unauthorized without a cookie', async () => {
    const f = jest.fn();
    await expect(sendChat(deps(f, ''), { messages, locale: 'en' })).rejects.toMatchObject({
      kind: 'unauthorized',
    });
    expect(f).not.toHaveBeenCalled();
  });

  it('maps errors', async () => {
    const err = async (status: number, headers: Record<string, string> = {}) => {
      try {
        await send(async () => json({ title: 'x' }, status, headers));
      } catch (e) {
        return e;
      }
    };
    expect(chatErrorKind(await err(401))).toBe('unauthorized');
    expect(chatErrorKind(await err(409))).toBe('busy');
    expect(chatErrorKind(await err(429, { 'X-AI-Quota-Remaining': '0' }))).toBe('quota');
    expect(chatErrorKind(await err(429))).toBe('failed');
    expect(chatErrorKind(await err(503))).toBe('failed');
    expect(chatErrorKind(await err(400))).toBe('failed');
  });

  it('maps network failures and unreadable bodies', async () => {
    const net = await send(async () => {
      throw new TypeError('offline');
    }).catch((e) => e);
    expect(net).toBeInstanceOf(AiError);
    expect(net.kind).toBe('network');
    expect(chatErrorKind(net)).toBe('failed');
    const bad = await send(async () => json({ nope: 1 })).catch((e) => e);
    expect(bad.kind).toBe('server');
  });

  it('aborts after the timeout', async () => {
    const f = (_: string, init: RequestInit) =>
      new Promise((_, reject) =>
        init.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
      );
    const e = await sendChat({ ...deps(f), timeoutMs: 5 }, { messages, locale: 'en' }).catch(
      (x) => x,
    );
    expect(e.kind).toBe('network');
  });

  it('drops malformed recipes and unknown ids, keeps at most 3 cards', async () => {
    const out = await send(async () =>
      json({
        text: 'ok',
        tools: [
          {
            tool: 'search_recipes',
            recipes: [
              recipe,
              { ...recipe, id: 'not-in-catalog' },
              { ...recipe, abv: 'x' },
              { ...recipe, status: 'weird' },
              { ...recipe, missing: [1] },
              null,
              ...recipes.slice(1, 6).map((r) => ({ ...recipe, id: r.id })),
            ],
          },
          { tool: 5, recipes: [] },
          'junk',
        ],
      }),
    );
    expect(out.tools).toHaveLength(1);
    expect(out.tools[0]?.recipes).toHaveLength(3);
    expect(out.tools[0]?.recipes[0]?.id).toBe(id);
  });
});

describe('trimHistory', () => {
  it('keeps the last 20 lines and truncates', () => {
    const lines = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      text: `${i}`.padEnd(3000, 'x'),
    }));
    const out = trimHistory(lines);
    expect(out).toHaveLength(20);
    expect(out[0]?.text.startsWith('5')).toBe(true);
    expect(out[0]?.text).toHaveLength(2000);
    expect(out[19]?.role).toBe('user');
    expect(out[19]?.text).toHaveLength(500);
  });
});

describe('localIsoTime', () => {
  it('writes local time with the UTC offset', () => {
    const d = new Date(2026, 0, 5, 3, 4, 5);
    const off = -d.getTimezoneOffset();
    const sign = off < 0 ? '-' : '+';
    const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0');
    const mm = String(Math.abs(off) % 60).padStart(2, '0');
    expect(localIsoTime(d)).toBe(`2026-01-05T03:04:05${sign}${hh}:${mm}`);
  });
});
