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

/**
 * A reserved model call whose output is streamed: the request is already counted and the budget reserved.
 * `settle` must be called exactly once when the stream ends; later calls are ignored.
 */
export interface AiLease {
  model: ModelHandle;
  remaining: number;
  /** Charges what the provider reported (the whole reservation when it reported nothing) and logs the call. */
  settle(usage: TokenUsage | undefined, error?: unknown): Promise<void>;
}

export type AiLeaseOutcome =
  | { ok: true; lease: AiLease }
  | { ok: false; reason: 'quota'; remaining: 0 }
  | { ok: false; reason: 'unavailable'; remaining: number | null };

export interface AiGateway {
  /** At least one provider is configured. */
  readonly enabled: boolean;
  /**
   * Like `run`, for a streamed answer: reserves a request and budget up front and leaves the call to the
   * caller. No fallback between providers once the stream starts, so the first model that fits is used.
   */
  open(caller: AiCaller, feature: string, estimate: CallEstimate): Promise<AiLeaseOutcome>;
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

  /** Region, models in fallback order and one request taken from the user's daily quota. */
  async function admit(
    caller: AiCaller,
  ): Promise<
    | { ok: true; models: ModelHandle[]; day: string; month: string; remaining: number }
    | { ok: false; reason: 'quota'; remaining: 0 }
    | { ok: false; reason: 'unavailable'; remaining: null }
  > {
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
    const limit = options.dailyLimits[profile.plan] ?? options.dailyLimits.free;
    const remaining = await store.reserveRequest(caller.userId, day, limit);
    if (remaining === null) return { ok: false, reason: 'quota', remaining: 0 };
    return { ok: true, models, day, month: utcMonth(at), remaining };
  }

  async function record(
    caller: AiCaller,
    feature: string,
    handle: ModelHandle,
    at: { day: string; month: string; reserved: number; started: number },
    usage: TokenUsage | undefined,
    failure: unknown,
  ): Promise<void> {
    const cost =
      usage?.inputTokens === undefined || usage.outputTokens === undefined
        ? at.reserved
        : costMicros(handle.price, usage.inputTokens, usage.outputTokens);
    await store.settleSpend(handle.provider, at.month, at.reserved, cost);
    await store.addTokens(caller.userId, at.day, usage?.inputTokens ?? 0, usage?.outputTokens ?? 0);
    const fields = {
      requestId: caller.requestId,
      feature,
      model: handle.name,
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      costMicros: cost,
      ms: Math.round(performance.now() - at.started),
    };
    if (failure === undefined) logger.info('ai call', fields);
    else {
      logger.warn('ai call failed', {
        ...fields,
        error: failure instanceof Error ? failure.message : String(failure),
      });
    }
  }

  return {
    enabled,
    store,
    async open(caller, feature, estimate) {
      const admitted = await admit(caller);
      if (!admitted.ok) return admitted;
      const { models, day, month, remaining } = admitted;
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
        const at = { day, month, reserved, started: performance.now() };
        let settled = false;
        return {
          ok: true,
          lease: {
            model: handle,
            remaining,
            async settle(usage, error) {
              if (settled) return;
              settled = true;
              await record(caller, feature, handle, at, usage, error);
            },
          },
        };
      }
      // No model was called: the request goes back to the user.
      await store.releaseRequest(caller.userId, day);
      return { ok: false, reason: 'unavailable', remaining: remaining + 1 };
    },
    async run(caller, feature, estimate, call) {
      const admitted = await admit(caller);
      if (!admitted.ok) return admitted;
      const { models, day, month, remaining } = admitted;

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
        const at = { day, month, reserved, started: performance.now() };
        let result: Awaited<ReturnType<typeof call>> | undefined;
        let failure: unknown;
        try {
          result = await call(handle);
        } catch (error) {
          // A thrown `undefined` still counts as a failure in the log.
          failure = error ?? new Error('call failed');
        }
        // A failed call may still be billed (unparsable or truncated output, a timeout after the request
        // was sent): charge what the provider reported, or the whole reservation when it reported nothing.
        await record(caller, feature, handle, at, result?.usage ?? billedUsage(failure), failure);
        if (result) return { ok: true, value: result.value, model: handle.name, remaining };
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
