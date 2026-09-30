import { MAX_CHANGE_OPS } from '@sipclock/domain';

import { type CrudEntryLike, idempotencyKey, mapCrudEntries } from './upload';

/** The parts of the PowerSync database the connector uses. */
export interface UploadSource {
  getCrudBatch(limit?: number): Promise<{
    crud: CrudEntryLike[];
    haveMore: boolean;
    complete: () => Promise<void>;
  } | null>;
  getClientId(): Promise<string>;
}

export interface ConnectorDeps {
  apiUrl: string;
  powersyncUrl: string;
  /** Better Auth session cookie header value; empty when signed out. */
  getCookie: () => Promise<string>;
  fetch?: typeof fetch;
  /** Called when the API says the session is gone (401), so the app can refresh its auth state. */
  onUnauthorized?: () => void;
  log?: (message: string, detail?: unknown) => void;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Responses where the API rejected the batch itself (the contract), which retrying cannot fix. Anything else,
 * including 403/404/405 from a proxy or a maintenance page, is retried: dropping a batch loses user data.
 */
export function isPermanentFailure(status: number): boolean {
  return [400, 413, 415, 422].includes(status);
}

/**
 * PowerSync backend connector (`PowerSyncBackendConnector`).
 *
 * - `fetchCredentials`: a 15-minute JWT from Better Auth's JWT plugin (`GET /api/auth/token`), or null when
 *   there is no session. Network errors throw so PowerSync retries.
 * - `uploadData`: drains the upload queue in batches of up to 500 entries into `POST /v1/me/changes`.
 *   A contract rejection (400, 413, 415, 422) is logged and the batch completed, so one bad write cannot
 *   block every later one; everything else throws, and PowerSync retries later and keeps the queue.
 */
export function createConnector(deps: ConnectorDeps) {
  const doFetch = deps.fetch ?? fetch;
  const log = deps.log ?? ((message, detail) => console.warn(`[sync] ${message}`, detail ?? ''));

  async function authedFetch(path: string, init: RequestInit = {}): Promise<Response | null> {
    const cookie = await deps.getCookie();
    if (!cookie) return null;
    return doFetch(`${deps.apiUrl}${path}`, {
      ...init,
      credentials: 'omit',
      headers: { ...(init.headers as Record<string, string>), Cookie: cookie },
    });
  }

  return {
    async fetchCredentials() {
      const res = await authedFetch('/api/auth/token');
      if (!res) return null;
      if (res.status === 401) {
        deps.onUnauthorized?.();
        return null;
      }
      if (!res.ok) throw new HttpError(res.status, `token request failed: ${res.status}`);
      const body = (await res.json()) as { token?: unknown };
      if (typeof body.token !== 'string') throw new Error('token response has no token');
      return { endpoint: deps.powersyncUrl, token: body.token };
    },

    async uploadData(db: UploadSource) {
      for (;;) {
        const batch = await db.getCrudBatch(MAX_CHANGE_OPS);
        if (!batch) return;

        const { ops, rejected } = mapCrudEntries(batch.crud);
        for (const r of rejected) log(`dropping ${r.entry.table}/${r.entry.id}: ${r.reason}`);

        if (ops.length > 0) {
          const body = JSON.stringify({ ops });
          const key = idempotencyKey(await db.getClientId(), batch.crud, body);
          const res = await authedFetch('/v1/me/changes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
            body,
          });
          // Signed out while uploading: keep the queue; it uploads after the next sign-in or is cleared on sign-out.
          if (!res) throw new Error('not signed in');
          if (res.status === 401) {
            deps.onUnauthorized?.();
            throw new HttpError(401, 'session expired');
          }
          if (!res.ok) {
            const detail = await res.text().catch(() => '');
            if (!isPermanentFailure(res.status)) {
              throw new HttpError(res.status, `upload failed: ${res.status}`);
            }
            log(`server rejected a batch of ${ops.length} (${res.status}); skipping it`, detail);
          }
        }

        await batch.complete();
        if (!batch.haveMore) return;
      }
    },
  };
}
