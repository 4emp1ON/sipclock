import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { embed, type LanguageModel } from 'ai';
import type { Env } from '../env.ts';
import type { Provider } from './region.ts';

/** Price per token in millionths of the provider's billing currency. */
export interface TokenPrice {
  input: number;
  output: number;
}

export interface ModelHandle {
  provider: Provider;
  /** Short id for logs and cache keys (no folder ids or secrets). */
  name: string;
  /** A model object (never a gateway id string), so it can be wrapped in middleware. */
  model: Exclude<LanguageModel, string>;
  price: TokenPrice;
}

/** Monthly cap per provider, in millionths of its billing currency (RUB for Yandex, USD for Anthropic). */
export type Budgets = Record<Provider, number>;

// Yandex AI Studio, sync mode, RUB incl. VAT per 1K tokens → micro-RUB per token. Unknown models get the
// most expensive listed price, so a budget never underestimates.
const YANDEX_PRICES: Record<string, TokenPrice> = {
  'aliceai-llm': { input: 500, output: 1200 },
  'aliceai-llm-flash': { input: 100, output: 200 },
  'yandexgpt-5.1': { input: 800, output: 800 },
  'yandexgpt-5-pro': { input: 1200, output: 1200 },
  'yandexgpt-5-lite': { input: 200, output: 200 },
};
const YANDEX_FALLBACK_PRICE: TokenPrice = { input: 1200, output: 1200 };

// Anthropic, USD per million tokens → micro-USD per token.
const ANTHROPIC_PRICES: Record<string, TokenPrice> = {
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-sonnet-5': { input: 2, output: 10 },
};
const ANTHROPIC_FALLBACK_PRICE: TokenPrice = { input: 10, output: 50 };

export interface ModelRegistry {
  /** Model for a provider, or `undefined` when that provider is not configured. */
  get(provider: Provider): ModelHandle | undefined;
  budgets: Budgets;
}

type ProviderEnv = Pick<
  Env,
  | 'YANDEX_API_KEY'
  | 'YANDEX_FOLDER_ID'
  | 'YANDEX_MODEL'
  | 'ANTHROPIC_API_KEY'
  | 'ANTHROPIC_BASE_URL'
  | 'ANTHROPIC_RELAY_KEY'
  | 'ANTHROPIC_MODEL'
  | 'AI_BUDGET_YANDEX_RUB'
  | 'AI_BUDGET_ANTHROPIC_USD'
>;

export function createModelRegistry(env: ProviderEnv): ModelRegistry {
  const handles = new Map<Provider, ModelHandle>();

  if (env.YANDEX_API_KEY && env.YANDEX_FOLDER_ID) {
    const yandex = createOpenAICompatible({
      name: 'yandex',
      baseURL: 'https://ai.api.cloud.yandex.net/v1',
      apiKey: env.YANDEX_API_KEY,
      headers: { 'x-folder-id': env.YANDEX_FOLDER_ID },
      supportsStructuredOutputs: true,
      includeUsage: true,
    });
    const family = env.YANDEX_MODEL.split('/')[0] ?? env.YANDEX_MODEL;
    handles.set('yandex', {
      provider: 'yandex',
      name: `yandex/${env.YANDEX_MODEL}`,
      model: yandex.chatModel(`gpt://${env.YANDEX_FOLDER_ID}/${env.YANDEX_MODEL}`),
      price: YANDEX_PRICES[family] ?? YANDEX_FALLBACK_PRICE,
    });
  }

  // Never called directly from the Russian server: only through the relay (docs/adr/0007).
  if (env.ANTHROPIC_API_KEY && env.ANTHROPIC_BASE_URL) {
    const anthropic = createAnthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      baseURL: env.ANTHROPIC_BASE_URL,
      ...(env.ANTHROPIC_RELAY_KEY ? { headers: { 'X-Proxy-Key': env.ANTHROPIC_RELAY_KEY } } : {}),
    });
    handles.set('anthropic', {
      provider: 'anthropic',
      name: `anthropic/${env.ANTHROPIC_MODEL}`,
      model: anthropic(env.ANTHROPIC_MODEL),
      price: ANTHROPIC_PRICES[env.ANTHROPIC_MODEL] ?? ANTHROPIC_FALLBACK_PRICE,
    });
  }

  return {
    get: (provider) => handles.get(provider),
    budgets: {
      yandex: Math.round(env.AI_BUDGET_YANDEX_RUB * 1_000_000),
      anthropic: Math.round(env.AI_BUDGET_ANTHROPIC_USD * 1_000_000),
    },
  };
}

export function costMicros(price: TokenPrice, inputTokens: number, outputTokens: number): number {
  return Math.ceil(price.input * inputTokens + price.output * outputTokens);
}

/** Text embeddings for search: separate document and query models, one input per call. */
export interface Embedder {
  provider: Provider;
  /** Short id stored with each vector, so a model change re-embeds the catalog. */
  name: string;
  /** Micro-RUB per token (Yandex text vectorization), for the monthly budget. */
  pricePerToken: number;
  embed(
    kind: 'doc' | 'query',
    text: string,
    signal?: AbortSignal,
  ): Promise<{ vector: number[]; tokens: number }>;
}

// Yandex text vectorization is priced per 1K tokens far below generation; overestimated on purpose.
const YANDEX_EMBEDDING_PRICE_PER_TOKEN = 20;

export function createEmbedder(
  env: Pick<Env, 'YANDEX_API_KEY' | 'YANDEX_FOLDER_ID'>,
): Embedder | undefined {
  if (!env.YANDEX_API_KEY || !env.YANDEX_FOLDER_ID) return undefined;
  const folder = env.YANDEX_FOLDER_ID;
  const yandex = createOpenAICompatible({
    name: 'yandex',
    baseURL: 'https://ai.api.cloud.yandex.net/v1',
    apiKey: env.YANDEX_API_KEY,
    headers: { 'x-folder-id': folder },
  });
  // Yandex accepts exactly one string per request.
  const models = {
    doc: yandex.textEmbeddingModel(`emb://${folder}/text-search-doc/latest`),
    query: yandex.textEmbeddingModel(`emb://${folder}/text-search-query/latest`),
  };
  return {
    provider: 'yandex',
    name: 'yandex/text-search/latest',
    pricePerToken: YANDEX_EMBEDDING_PRICE_PER_TOKEN,
    async embed(kind, text, signal) {
      const { embedding, usage } = await embed({
        model: models[kind],
        value: text,
        // Queries must answer fast; the indexer can wait out a rate limit.
        maxRetries: kind === 'doc' ? 4 : 1,
        ...(signal ? { abortSignal: signal } : {}),
      });
      return { vector: embedding, tokens: usage.tokens };
    },
  };
}
