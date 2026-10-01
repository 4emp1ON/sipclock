import { NoObjectGeneratedError } from 'ai';
import type { Logger } from '../lib/logger.ts';
import { costMicros, type ModelHandle, type ModelRegistry } from './providers.ts';
import { decideRegion, type Provider } from './region.ts';
import type { AiStore } from './store.ts';

export interface AiCaller {
  userId: string;
  /** ISO country of the client address, if known. */
  country: string | undefined;
  locale: string | undefined;
  requestId: string;
}

export interface CallEstimate {
  inputTokens: number;
  maxOutputTokens: number;
}

export interface TokenUsage {
  /** `undefined` when the provider did not report it; the call is then charged its full reservation. */
  inputTokens: number | undefined;
  outputTokens: number | undefined;
}

export interface CallResult<T> {
  value: T;
  usage: TokenUsage;
}

export type AiOutcome<T> =
  | { ok: true; value: T; model: string; remaining: number }
  | { ok: false; reason: 'quota'; remaining: 0 }
  | { ok: false; reason: 'unavailable'; remaining: number | null };

export interface AiGateway {
  /** At least one provider is configured. */
  readonly enabled: boolean;
  /**
   * One model call on behalf of a user: picks the provider for the user's region, counts it against the
   * daily quota, reserves budget, falls back from Claude to Yandex on failure and records usage.
   */
  run<T>(
    caller: AiCaller,
    feature: string,
    estimate: CallEstimate,
    call: (model: ModelHandle) => Promise<CallResult<T>>,
  ): Promise<AiOutcome<T>>;
  store: AiStore;
}

export interface GatewayOptions {
  registry: ModelRegistry;
  store: AiStore;
  logger: Logger;
  /** Daily request limit per plan; unknown plans get `free`. */
  dailyLimits: { free: number } & Record<string, number>;
  now?: () => Date;
}

/** Token usage carried by an AI SDK error thrown after the model answered (e.g. output not matching the schema). */
function billedUsage(error: unknown): TokenUsage | undefined {
  if (NoObjectGeneratedError.isInstance(error) && error.usage) {
    return { inputTokens: error.usage.inputTokens, outputTokens: error.usage.outputTokens };
  }
  return undefined;
}

const utcDay = (d: Date) => d.toISOString().slice(0, 10);
const utcMonth = (d: Date) => `${d.toISOString().slice(0, 7)}-01`;

export function createAiGateway(options: GatewayOptions): AiGateway {
  const { registry, store, logger } = options;
  const now = options.now ?? (() => new Date());
  const enabled = registry.get('yandex') !== undefined || registry.get('anthropic') !== undefined;

  return {
    enabled,
    store,
    async run(caller, feature, estimate, call) {
      const profile = await store.profile(caller.userId);
      const decision = decideRegion(
        { country: caller.country, locale: caller.locale, pinned: profile.pinned },
        registry.get('anthropic') !== undefined,
      );
      if (decision.pin) await store.pin(caller.userId);

      // Claude falls back to Yandex; a Russian user is never moved to Claude.
      const order: Provider[] =
        decision.provider === 'anthropic' ? ['anthropic', 'yandex'] : ['yandex'];
      const models = order
        .map((p) => registry.get(p))
        .filter((m): m is ModelHandle => m !== undefined);
      if (models.length === 0) return { ok: false, reason: 'unavailable', remaining: null };

      const at = now();
      const day = utcDay(at);
      const month = utcMonth(at);
      const limit = options.dailyLimits[profile.plan] ?? options.dailyLimits.free;
      const remaining = await store.reserveRequest(caller.userId, day, limit);
      if (remaining === null) return { ok: false, reason: 'quota', remaining: 0 };

      let attempted = false;
      for (const handle of models) {
        const reserved = costMicros(handle.price, estimate.inputTokens, estimate.maxOutputTokens);
        const fits = await store.reserveSpend(
          handle.provider,
          month,
          reserved,
          registry.budgets[handle.provider],
        );
        if (!fits) {
          logger.warn('ai budget exhausted', { provider: handle.provider, feature });
          continue;
        }
        attempted = true;
        const started = performance.now();
        let result: Awaited<ReturnType<typeof call>> | undefined;
        let failure: unknown;
        try {
          result = await call(handle);
        } catch (error) {
          failure = error;
        }
        // A failed call may still be billed (unparsable or truncated output, a timeout after the request
        // was sent): charge what the provider reported, or the whole reservation when it reported nothing.
        const usage = result?.usage ?? billedUsage(failure);
        const cost =
          usage?.inputTokens === undefined || usage.outputTokens === undefined
            ? reserved
            : costMicros(handle.price, usage.inputTokens, usage.outputTokens);
        await store.settleSpend(handle.provider, month, reserved, cost);
        await store.addTokens(
          caller.userId,
          day,
          usage?.inputTokens ?? 0,
          usage?.outputTokens ?? 0,
        );
        const fields = {
          requestId: caller.requestId,
          feature,
          model: handle.name,
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
          costMicros: cost,
          ms: Math.round(performance.now() - started),
        };
        if (result) {
          logger.info('ai call', fields);
          return { ok: true, value: result.value, model: handle.name, remaining };
        }
        logger.warn('ai call failed', {
          ...fields,
          error: failure instanceof Error ? failure.message : String(failure),
        });
      }

      // The quota is given back only when no model was called; a failed call still cost money.
      if (!attempted) {
        await store.releaseRequest(caller.userId, day);
        return { ok: false, reason: 'unavailable', remaining: remaining + 1 };
      }
      return { ok: false, reason: 'unavailable', remaining };
    },
  };
}
