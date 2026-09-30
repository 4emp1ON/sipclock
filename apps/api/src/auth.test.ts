import { describe, expect, it } from 'vitest';
import { createOtpSender, nativeAppOrigin, trustedOrigins } from './auth.ts';
import { parseEnv } from './env.ts';
import { createLogger } from './lib/logger.ts';

function capture() {
  const logs: { level: string; msg: string; [k: string]: unknown }[] = [];
  return { logs, logger: createLogger('debug', (line) => logs.push(JSON.parse(line))) };
}

const FROM = 'Sipclock <onboarding@resend.dev>';
const otp = { email: 'a@example.test', otp: '123456', type: 'sign-in' as const };

describe('email OTP sender', () => {
  it('logs the code outside production when Resend is not configured', async () => {
    const { logs, logger } = capture();
    await createOtpSender({ NODE_ENV: 'development', EMAIL_FROM: FROM }, logger)(otp);
    expect(logs).toEqual([
      expect.objectContaining({ level: 'info', msg: 'email otp (dev)', otp: '123456' }),
    ]);
  });

  it('never logs the code in production without Resend', async () => {
    const { logs, logger } = capture();
    await createOtpSender({ NODE_ENV: 'production', EMAIL_FROM: FROM }, logger)(otp);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.level).toBe('error');
    expect(JSON.stringify(logs)).not.toContain('123456');
  });

  it('sends through Resend without waiting for delivery and logs failures', async () => {
    const { logs, logger } = capture();
    const requests: { url: string; init: RequestInit }[] = [];
    let respond: (res: Response) => void = () => {};
    const fetchImpl = ((url: string, init: RequestInit) => {
      requests.push({ url, init });
      return new Promise<Response>((resolve) => {
        respond = resolve;
      });
    }) as typeof fetch;
    const send = createOtpSender(
      { NODE_ENV: 'production', EMAIL_FROM: FROM, RESEND_API_KEY: 're_test' },
      logger,
      fetchImpl,
    );
    // Resolves while the provider request is still pending.
    await send(otp);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe('https://api.resend.com/emails');
    expect(new Headers(requests[0]?.init.headers).get('authorization')).toBe('Bearer re_test');
    const body = JSON.parse(String(requests[0]?.init.body));
    expect(body).toMatchObject({
      from: FROM,
      to: ['a@example.test'],
      subject: 'Your Sipclock sign-in code',
    });
    expect(body.text).toContain('123456');

    respond(new Response('{"message":"invalid"}', { status: 422 }));
    await new Promise((r) => setTimeout(r, 0));
    expect(logs).toEqual([
      expect.objectContaining({ level: 'error', msg: 'email otp send failed', status: 422 }),
    ]);
  });
});

describe('native app origin', () => {
  const run = (headers: Record<string, string>) =>
    // biome-ignore lint/style/noNonNullAssertion: the plugin always defines onRequest
    nativeAppOrigin().onRequest!(new Request('http://api/x', { headers }), {} as never);

  it('uses expo-origin when the request has no Origin', async () => {
    const result = await run({ 'expo-origin': 'sipclock://' });
    expect(result && 'request' in result && result.request.headers.get('origin')).toBe(
      'sipclock://',
    );
  });

  it('never overrides a browser Origin', async () => {
    expect(
      await run({ origin: 'https://evil.example', 'expo-origin': 'sipclock://' }),
    ).toBeUndefined();
    expect(await run({})).toBeUndefined();
  });
});

describe('trusted origins', () => {
  it('adds the app scheme everywhere and Expo Go only outside production', () => {
    expect(trustedOrigins({ NODE_ENV: 'production', CORS_ORIGINS: ['https://a.test'] })).toEqual([
      'https://a.test',
      'sipclock://',
    ]);
    expect(trustedOrigins({ NODE_ENV: 'development', CORS_ORIGINS: [] })).toEqual(
      expect.arrayContaining(['sipclock://', 'exp://']),
    );
  });
});

describe('env', () => {
  const base = {
    DATABASE_URL: 'postgres://localhost/x',
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:8787',
  };

  it('defaults the accounts settings, treating empty values as unset', () => {
    const env = parseEnv({
      ...base,
      EMAIL_FROM: '',
      POWERSYNC_AUDIENCE: '',
      RESEND_API_KEY: '',
      EDGE_PROXY_SECRET: '',
    });
    expect(env).toMatchObject({ EMAIL_FROM: FROM, POWERSYNC_AUDIENCE: 'sipclock-powersync' });
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.EDGE_PROXY_SECRET).toBeUndefined();
  });

  it('requires the email key and the edge proxy secret in production', () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'production' })).toThrow(
      /RESEND_API_KEY: is required in production[\s\S]*EDGE_PROXY_SECRET: is required in production/,
    );
    const env = parseEnv({
      ...base,
      NODE_ENV: 'production',
      RESEND_API_KEY: 're_x',
      EDGE_PROXY_SECRET: 's'.repeat(32),
    });
    expect(env.NODE_ENV).toBe('production');
  });

  it('rejects a short edge proxy secret', () => {
    expect(() => parseEnv({ ...base, EDGE_PROXY_SECRET: 'short' })).toThrow(/EDGE_PROXY_SECRET/);
  });
});
