// promptfoo provider for "Find a swap": drives the real substitutes service (prompt, schema, guard, cache)
// with an in-memory store, so what is graded is what production would answer. The prompt promptfoo passes in
// is ignored; the case comes from `vars`.

import { createIndex } from '@sipclock/engine';
import { MockLanguageModelV4 } from 'ai/test';
import type {
  ApiProvider,
  CallApiContextParams,
  ProviderOptions,
  ProviderResponse,
} from 'promptfoo';
import { createAiGateway } from '../../src/ai/gateway.ts';
import { createModelRegistry, type ModelRegistry } from '../../src/ai/providers.ts';
import { createMemoryAiStore } from '../../src/ai/store.ts';
import { parseEnv } from '../../src/env.ts';
import { createLogger } from '../../src/lib/logger.ts';
import { createBundledCatalogService } from '../../src/services/catalog.ts';
import {
  createSubstitutesService,
  type Locale,
  type SubstitutesService,
  substituteCandidates,
} from '../../src/services/substitutes.ts';

interface Setup {
  service: SubstitutesService;
  store: ReturnType<typeof createMemoryAiStore>;
  index: ReturnType<typeof createIndex>;
}

/** Answers with the first candidate of the request, so the pipeline can run without a key. */
function mockRegistry(base: ModelRegistry): ModelRegistry {
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      const text = JSON.stringify(options.prompt);
      const line = /Candidates: ([^\\]*)/.exec(text)?.[1] ?? '';
      const first =
        line
          .split(', ')[0]
          ?.replace(/[*~(].*$/, '')
          .trim() ?? '';
      const ru = text.includes('Language: Russian');
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              suggestions: [
                {
                  ingredientId: first,
                  fit: 'close',
                  note: ru ? 'Вкус остаётся узнаваемым.' : 'The drink stays recognisable.',
                },
              ],
              canSkip: false,
            }),
          },
        ],
        finishReason: { unified: 'stop', raw: undefined },
        usage: {
          inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 30, text: 30, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
  return {
    budgets: base.budgets,
    get: (provider) =>
      provider === 'yandex'
        ? {
            provider: 'yandex',
            name: 'mock',
            model,
            price: { input: 0, output: 0 },
          }
        : undefined,
  };
}

export default class SubstitutesProvider implements ApiProvider {
  readonly config: { model?: string };
  readonly label: string;
  private setup: Setup | undefined;

  constructor(options: ProviderOptions = {}) {
    this.config = (options.config ?? {}) as { model?: string };
    this.label = options.label ?? `sipclock-substitutes:${this.config.model ?? 'default'}`;
  }

  id(): string {
    return this.label;
  }

  private build(): Setup | string {
    if (this.setup) return this.setup;
    const mock = process.env.EVALS_MOCK === '1';
    const env = { ...parseEnv() };
    if (this.config.model) env.YANDEX_MODEL = this.config.model;
    if (!mock && !(env.YANDEX_API_KEY && env.YANDEX_FOLDER_ID)) {
      return 'YANDEX_API_KEY / YANDEX_FOLDER_ID not set';
    }
    const base = createModelRegistry(env);
    const store = createMemoryAiStore();
    const gateway = createAiGateway({
      registry: mock ? mockRegistry(base) : base,
      store,
      logger: createLogger('warn'),
      dailyLimits: { free: 10_000 },
    });
    const catalogService = createBundledCatalogService(process.env.CATALOG_DIR);
    this.setup = {
      service: createSubstitutesService(catalogService, gateway),
      store,
      index: createIndex(catalogService.catalog),
    };
    return this.setup;
  }

  async callApi(_prompt: string, context?: CallApiContextParams): Promise<ProviderResponse> {
    const vars = (context?.vars ?? {}) as Record<string, unknown>;
    const recipeId = String(vars.recipeId ?? '');
    const ingredientId = String(vars.ingredientId ?? '');
    const locale: Locale = vars.locale === 'ru' ? 'ru' : 'en';
    const bar = Array.isArray(vars.bar) ? vars.bar.map(String) : [];

    const setup = this.build();
    if (typeof setup === 'string') return { error: setup };

    // A fresh user per call, so the per-user quota never interferes and its token usage is readable.
    const userId = `eval-${Math.random().toString(36).slice(2)}`;
    const out = await setup.service.suggest(
      { recipeId, ingredientId, bar, locale },
      {
        userId,
        country: undefined,
        locale,
        requestId: `eval-${recipeId}-${ingredientId}-${locale}`,
      },
    );
    if (!out.ok) return { error: `${recipeId}/${ingredientId}: ${out.error}` };

    const { source, suggestions, canSkip } = out.result;
    const candidates = substituteCandidates(setup.index, ingredientId, locale).map((c) => c.id);
    let input = 0;
    let output = 0;
    for (const [key, row] of setup.store.usage) {
      if (key.startsWith(`${userId}:`)) {
        input += row.input;
        output += row.output;
      }
    }
    return {
      output: JSON.stringify({ source, suggestions, canSkip, candidates }),
      tokenUsage: { prompt: input, completion: output, total: input + output },
      metadata: {
        recipeId,
        ingredientId,
        locale,
        model: this.config.model ?? 'default',
        mock: process.env.EVALS_MOCK === '1',
      },
    };
  }
}
