import { createIndex } from '@sipclock/engine';
import type { TextStreamPart, ToolSet } from 'ai';
import { describe, expect, it } from 'vitest';
import { createBundledCatalogService } from './catalog.ts';
import {
  brandMaskTransform,
  createBrandMasker,
  createChatToolFactory,
  momentFrom,
  type RecipeCard,
} from './chat.ts';

const catalog = createBundledCatalogService();
const index = createIndex(catalog.catalog);

describe('createBrandMasker', () => {
  it('replaces brands with the generic ingredient in the answer language', () => {
    const en = createBrandMasker(index, 'en');
    expect(en('Stir gin, Campari and sweet vermouth.')).toBe(
      'Stir gin, red bitter aperitif and sweet vermouth.',
    );
    expect(en("A dash of Angostura, then Hendrick's.")).toBe(
      'A dash of aromatic bitters, then gin.',
    );
    expect(en('Grand  Marnier or St-Germain')).toBe('orange liqueur or elderflower liqueur');
    // Words that merely contain a brand stay.
    expect(en('Bombastic')).toBe('Bombastic');
  });

  it('matches Russian case endings', () => {
    const ru = createBrandMasker(index, 'ru');
    expect(ru('Добавьте пару капель Ангостуры.')).toBe(
      'Добавьте пару капель ароматический биттер.',
    );
    expect(ru('с Кампари')).toBe('с красный горький аперитив');
    expect(ru('Это абсолютно верно. Абсолютный классик.')).toBe(
      'Это абсолютно верно. Абсолютный классик.',
    );
    expect(ru('бутылка Абсолюта')).toBe('бутылка водка');
  });
});

async function run(parts: TextStreamPart<ToolSet>[], mask: (t: string) => string) {
  const stream = new ReadableStream<TextStreamPart<ToolSet>>({
    start(c) {
      for (const p of parts) c.enqueue(p);
      c.close();
    },
  }).pipeThrough(brandMaskTransform(mask)());
  const out: TextStreamPart<ToolSet>[] = [];
  for await (const p of stream) out.push(p);
  return out;
}

describe('brandMaskTransform', () => {
  const mask = createBrandMasker(index, 'en');
  const delta = (text: string): TextStreamPart<ToolSet> => ({ type: 'text-delta', id: 't', text });

  it('masks a brand split across chunks and keeps the text otherwise intact', async () => {
    const text = 'Use Grand Marnier instead, or skip it.';
    const chunks = ['Use Gr', 'and', ' Mar', 'nier inst', 'ead, or skip it.'];
    const out = await run(
      [{ type: 'text-start', id: 't' }, ...chunks.map(delta), { type: 'text-end', id: 't' }],
      mask,
    );
    const joined = out.flatMap((p) => (p.type === 'text-delta' ? [p.text] : [])).join('');
    expect(joined).toBe(mask(text));
    expect(joined).not.toMatch(/marnier/i);
    expect(out.at(-1)?.type).toBe('text-end');
  });

  it('never masks a word that is still being typed', async () => {
    const out = await run(
      [
        { type: 'text-start', id: 't' },
        ...['Absol', 'ut', 'ely fine, and Fernet ', '- Bra', 'nca too.'].map(delta),
        { type: 'text-end', id: 't' },
      ],
      mask,
    );
    const joined = out.flatMap((p) => (p.type === 'text-delta' ? [p.text] : [])).join('');
    expect(joined).toBe('Absolutely fine, and fernet too.');
  });

  it('passes other parts through in order', async () => {
    const parts: TextStreamPart<ToolSet>[] = [
      { type: 'text-start', id: 't' },
      delta('Hello there'),
      { type: 'text-end', id: 't' },
    ];
    const out = await run(parts, mask);
    // One space: nothing is safe to send until the part ends.
    expect(out.map((p) => p.type)).toEqual(['text-start', 'text-delta', 'text-end']);
  });
});

describe('momentFrom', () => {
  it('reads the local wall clock as written, with the weekday', () => {
    expect(momentFrom('2026-10-02T19:05:00+03:00', new Date())).toEqual({
      year: 2026,
      month: 10,
      day: 2,
      weekday: 5,
      hour: 19,
      minute: 5,
      hemisphere: 'north',
    });
  });
});

describe('chat tools', () => {
  const tools = createChatToolFactory({
    catalog,
    userData: {
      snapshot: async () => ({
        bar: ['gin', 'tonic-water', 'lime', 'not-an-id'],
        favorites: [],
        history: [],
      }),
    },
  })({
    userId: 'u1',
    locale: 'en',
    moment: momentFrom('2026-10-02T19:00:00+03:00', new Date()),
  });
  const exec = async (name: string, input: unknown) => {
    const t = tools[name];
    if (!t?.execute) throw new Error(`no tool ${name}`);
    return (await t.execute(input as never, { toolCallId: 'c', messages: [] } as never)) as Record<
      string,
      unknown
    >;
  };

  it('reads the bar, dropping unknown ids', async () => {
    const out = await exec('get_my_bar', {});
    expect(out.count).toBe(3);
  });

  it('lists what the bar makes, ready first', async () => {
    const out = await exec('what_can_i_make', {});
    const cards = out.recipes as RecipeCard[];
    expect(cards[0]).toMatchObject({ id: 'gin-and-tonic', status: 'ready', name: 'Gin & Tonic' });
    expect(cards.length).toBeLessThanOrEqual(6);
    for (const c of cards)
      expect(c.status === 'missing' ? c.missing.length : 0).toBeLessThanOrEqual(1);
  });

  it('marks loose substitutes and reports skippable lines', async () => {
    const out = await exec('find_substitutes', {
      recipeId: 'gin-and-tonic',
      ingredientId: 'tonic-water',
    });
    expect(out.canSkip).toBe(false);
    expect(out.substitutes).toContainEqual(
      expect.objectContaining({ id: 'soda-water', kind: 'changes the drink' }),
    );
  });

  it('answers unknown ids with an error the model can recover from', async () => {
    expect(await exec('get_recipe', { recipeId: 'nope' })).toHaveProperty('error');
    expect(
      await exec('find_substitutes', { recipeId: 'negroni', ingredientId: 'tonic-water' }),
    ).toHaveProperty('error');
  });

  it('finds recipes by name or ingredient and picks for now', async () => {
    const found = (await exec('search_recipes', { query: 'negroni' })).recipes as RecipeCard[];
    expect(found[0]?.id).toBe('negroni');
    const now = (await exec('recommend_now', {})).recipes as RecipeCard[];
    expect(now.length).toBeGreaterThan(0);
  });
});
