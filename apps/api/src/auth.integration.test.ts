import { createPublicKey, randomUUID, verify } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
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
  const pwEmail = `pw-${randomUUID()}@example.test`;
  // Random, so it is not in any breach list (the check queries api.pwnedpasswords.com).
  const password = `Sip-${randomUUID()}`;
  const newPassword = `Sip-${randomUUID()}`;
  const lastCode = (to: string, type: string) =>
    logs.findLast((l) => l.msg === 'email otp (dev)' && l.email === to && l.type === type)?.otp as
      | string
      | undefined;
  const cookieOf = (res: Response) =>
    res.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');

  // Signing keys are encrypted with BETTER_AUTH_SECRET, and Better Auth signs with the newest key. Keys
  // left by a server using another secret would make signing fail, and ours would break that server,
  // so the test starts and ends without keys (a new one is minted on demand; tokens live 15 minutes).
  beforeAll(async () => {
    await handle.db.delete(jwks);
  });

  afterAll(async () => {
    await handle.db.delete(jwks);
    await handle.db.delete(user).where(inArray(user.email, [email, pwEmail]));
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

  describe('password accounts', () => {
    it('signs up only after the address is confirmed with a code', async () => {
      const weak = await post('/api/auth/sign-up/email', {
        email: pwEmail,
        password: 'short',
        name: '',
      });
      expect(weak.status).toBe(400);

      const signUp = await post('/api/auth/sign-up/email', { email: pwEmail, password, name: '' });
      expect(signUp.status).toBe(200);
      expect(cookieOf(signUp)).not.toContain('session_token');
      const code = lastCode(pwEmail, 'email-verification');
      expect(code).toMatch(/^\d{6}$/);

      // Unconfirmed: the password alone does not sign in.
      const early = await post('/api/auth/sign-in/email', { email: pwEmail, password });
      expect(early.status).toBe(403);
      expect(await early.json()).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });

      const verify = await post('/api/auth/email-otp/verify-email', { email: pwEmail, otp: code });
      expect(verify.status).toBe(200);
      expect(cookieOf(verify)).toContain('session_token');

      const signIn = await post('/api/auth/sign-in/email', { email: pwEmail, password });
      expect(signIn.status).toBe(200);
      expect(cookieOf(signIn)).toContain('session_token');
    });

    it('answers a sign-up for a taken address like a new one', async () => {
      const again = await post('/api/auth/sign-up/email', {
        email: pwEmail,
        password: newPassword,
        name: '',
      });
      expect(again.status).toBe(200);
      const wrong = await post('/api/auth/sign-in/email', {
        email: pwEmail,
        password: newPassword,
      });
      expect(wrong.status).toBe(401);
    });

    it('rejects breached passwords', async () => {
      const res = await post('/api/auth/sign-up/email', {
        email: `pwned-${randomUUID()}@example.test`,
        password: 'password12345',
        name: '',
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ code: 'PASSWORD_COMPROMISED' });
    });

    it('resets the password with a code and signs other sessions out', async () => {
      const before = cookieOf(await post('/api/auth/sign-in/email', { email: pwEmail, password }));
      expect(before).toContain('session_token');

      const request = await post('/api/auth/email-otp/request-password-reset', { email: pwEmail });
      expect(request.status).toBe(200);
      const code = lastCode(pwEmail, 'forget-password');
      const reset = await post('/api/auth/email-otp/reset-password', {
        email: pwEmail,
        otp: code,
        password: newPassword,
      });
      expect(reset.status).toBe(200);

      expect((await app.request('/v1/me/data', { headers: { cookie: before } })).status).toBe(401);
      expect((await post('/api/auth/sign-in/email', { email: pwEmail, password })).status).toBe(
        401,
      );
      const fresh = await post('/api/auth/sign-in/email', {
        email: pwEmail,
        password: newPassword,
      });
      expect(fresh.status).toBe(200);
    });
  });
});
