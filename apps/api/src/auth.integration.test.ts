import { createPublicKey, randomUUID, verify } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { createAuth, toAuthHandler } from './auth.ts';
import { createDb } from './db/client.ts';
import { jwks, user } from './db/schema/auth.ts';
import { barItem } from './db/schema/user-data.ts';
import { createLogger } from './lib/logger.ts';
import { createMemoryRateLimitStore } from './middleware/rate-limit.ts';
import { createBundledCatalogService } from './services/catalog.ts';
import { createUserDataService } from './services/user-data.ts';

const BASE = 'http://localhost:8787';
const ORIGIN = 'http://localhost:3000';

describe.skipIf(!process.env.DATABASE_URL)('Better Auth (integration)', () => {
  const handle = createDb(process.env.DATABASE_URL ?? '');
  const logs: { msg: string; [k: string]: unknown }[] = [];
  const logger = createLogger('debug', (line) => logs.push(JSON.parse(line)));
  const env = {
    NODE_ENV: 'test' as const,
    BETTER_AUTH_SECRET: 'integration-test-secret-integration-test-secret',
    BETTER_AUTH_URL: BASE,
    CORS_ORIGINS: [ORIGIN],
    EMAIL_FROM: 'Sipclock <onboarding@resend.dev>',
    POWERSYNC_AUDIENCE: 'sipclock-powersync',
  };
  const betterAuth = createAuth(handle.db, env, logger);
  const catalog = createBundledCatalogService();
  const app = createApp({
    env: {
      CORS_ORIGINS: [ORIGIN],
      NODE_ENV: 'test',
      TRUST_PROXY_HOPS: 0,
      RATE_LIMIT_RECOMMEND_PER_MIN: 60,
    },
    auth: toAuthHandler(betterAuth),
    catalog,
    userData: createUserDataService(handle.db, catalog),
    rateLimitStore: createMemoryRateLimitStore({ cleanupIntervalMs: 0 }),
    ping: handle.ping,
    logger,
  });
  const email = `otp-${randomUUID()}@example.test`;

  // Signing keys are encrypted with BETTER_AUTH_SECRET, and Better Auth signs with the newest key. Keys
  // left by a server using another secret would make signing fail, and ours would break that server,
  // so the test starts and ends without keys (a new one is minted on demand; tokens live 15 minutes).
  beforeAll(async () => {
    await handle.db.delete(jwks);
  });

  afterAll(async () => {
    await handle.db.delete(jwks);
    await handle.db.delete(user).where(eq(user.email, email));
    await handle.close();
  });

  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    app.request(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
      body: JSON.stringify(body),
    });

  it('the Drizzle schema matches what Better Auth expects', async () => {
    const ctx = await betterAuth.$context;
    expect(ctx.checkSchema).toBeTypeOf('function');
    // Returns a promise while checking and undefined once the schema is known to be good;
    // a mismatch rejects with SchemaMismatchError.
    await expect(Promise.resolve(ctx.checkSchema?.())).resolves.toBeUndefined();
  });

  let cookie = '';

  it('signs up with an emailed code (logged outside production)', async () => {
    const send = await post('/api/auth/email-otp/send-verification-otp', {
      email,
      type: 'sign-in',
    });
    expect(send.status).toBe(200);
    const otp = logs.find((l) => l.msg === 'email otp (dev)' && l.email === email)?.otp;
    expect(otp).toMatch(/^\d{6}$/);

    const wrong = await post('/api/auth/sign-in/email-otp', { email, otp: '000000' });
    expect(wrong.ok).toBe(false);

    const signIn = await post('/api/auth/sign-in/email-otp', { email, otp });
    expect(signIn.status).toBe(200);
    cookie = signIn.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    expect(cookie).toContain('session_token');
  });

  it('trusts the web origins and the app scheme only', async () => {
    // Better Auth skips its origin check when NODE_ENV=test, so check the resolved list directly.
    const ctx = await betterAuth.$context;
    const trusted = (url: string) => ctx.isTrustedOrigin(url, { allowRelativePaths: false });
    expect(trusted(ORIGIN)).toBe(true);
    expect(trusted('sipclock://')).toBe(true);
    expect(trusted('exp://192.168.1.20:8081')).toBe(true);
    expect(trusted('https://evil.test')).toBe(false);
    expect(trusted('evil://')).toBe(false);
  });

  it('the session unlocks /v1/me/*', async () => {
    const res = await post(
      '/v1/me/changes',
      { ops: [{ table: 'bar_item', op: 'put', id: 'gin', data: { in_bar: true, updated_at: 1 } }] },
      { cookie, 'idempotency-key': randomUUID() },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ applied: 1, skipped: 0 });
    const data = await app.request('/v1/me/data', { headers: { cookie } });
    expect(await data.json()).toMatchObject({ bar: ['gin'] });
  });

  it('issues a short-lived EdDSA JWT for PowerSync with a minimal payload', async () => {
    const res = await app.request(`${BASE}/api/auth/token`, { headers: { cookie } });
    expect(res.status).toBe(200);
    const { token } = (await res.json()) as { token: string };
    const [header, payload, signature] = token.split('.') as [string, string, string];
    const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    const { alg, kid } = decode(header) as { alg: string; kid: string };
    const claims = decode(payload) as Record<string, unknown>;
    const [row] = await handle.db.select({ id: user.id }).from(user).where(eq(user.email, email));

    expect(alg).toBe('EdDSA');
    expect(claims).toMatchObject({ sub: row?.id, aud: 'sipclock-powersync', iss: BASE });
    expect(Object.keys(claims).sort()).toEqual(['aud', 'exp', 'iat', 'iss', 'sub']);
    expect((claims.exp as number) - (claims.iat as number)).toBe(15 * 60);

    const jwks = (await (await app.request(`${BASE}/api/auth/jwks`)).json()) as {
      keys: { kid: string }[];
    };
    const jwk = jwks.keys.find((k) => k.kid === kid);
    expect(jwk).toBeDefined();
    const valid = verify(
      null,
      Buffer.from(`${header}.${payload}`),
      createPublicKey({ key: jwk as never, format: 'jwk' }),
      Buffer.from(signature, 'base64url'),
    );
    expect(valid).toBe(true);
  });

  it('deletes the account and its data', async () => {
    const [row] = await handle.db.select({ id: user.id }).from(user).where(eq(user.email, email));
    const res = await post('/api/auth/delete-user', {}, { cookie });
    expect(res.status).toBe(200);
    expect(await handle.db.select().from(user).where(eq(user.email, email))).toEqual([]);
    expect(
      await handle.db
        .select()
        .from(barItem)
        .where(eq(barItem.userId, row?.id ?? '')),
    ).toEqual([]);
    expect((await app.request('/v1/me/data', { headers: { cookie } })).status).toBe(401);
  });
});
