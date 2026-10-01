import { describe, expect, it } from 'vitest';
import {
  buildDownstreamHeaders,
  buildUpstreamHeaders,
  clientIp,
  mapProxyPath,
  proxyTimeoutMs,
  rewriteSetCookie,
} from './api-proxy';

describe('mapProxyPath', () => {
  it('passes auth through and maps me to v1', () => {
    expect(mapProxyPath('/api/auth/sign-in/email-otp')).toBe('/api/auth/sign-in/email-otp');
    expect(mapProxyPath('/api/auth')).toBe('/api/auth');
    expect(mapProxyPath('/api/me/data')).toBe('/v1/me/data');
    expect(mapProxyPath('/api/me/changes')).toBe('/v1/me/changes');
    expect(mapProxyPath('/api/me')).toBe('/v1/me');
    expect(mapProxyPath('/api/ai/substitutes')).toBe('/v1/ai/substitutes');
    expect(mapProxyPath('/api/ai')).toBe('/v1/ai');
  });
  it('rejects everything else', () => {
    expect(mapProxyPath('/api/health')).toBeNull();
    expect(mapProxyPath('/api/authx/foo')).toBeNull();
    expect(mapProxyPath('/api/meow')).toBeNull();
    expect(mapProxyPath('/api/aix/foo')).toBeNull();
    expect(mapProxyPath('/api')).toBeNull();
    expect(mapProxyPath('/v1/me/data')).toBeNull();
    // Open redirect in the expo plugin; the web never needs it.
    expect(mapProxyPath('/api/auth/expo-authorization-proxy')).toBeNull();
  });
  it('rejects traversal', () => {
    expect(mapProxyPath('/api/me/../auth/x')).toBeNull();
    expect(mapProxyPath('/api/me/%2e%2e/admin')).toBeNull();
    expect(mapProxyPath('/api/me/a%2Fb')).toBeNull();
    expect(mapProxyPath('/api/me/a\\b')).toBeNull();
  });
});

describe('proxyTimeoutMs', () => {
  it('gives AI paths 30 s and everything else 15 s', () => {
    expect(proxyTimeoutMs('/api/ai/substitutes')).toBe(30_000);
    expect(proxyTimeoutMs('/api/me/data')).toBe(15_000);
    expect(proxyTimeoutMs('/api/auth/get-session')).toBe(15_000);
  });
});

describe('clientIp', () => {
  it('takes the first x-forwarded-for entry', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe(
      '203.0.113.7',
    );
  });
  it('falls back to x-real-ip, then null', () => {
    expect(clientIp(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe('buildUpstreamHeaders', () => {
  const incoming = new Headers({
    cookie: 'a=1',
    'content-type': 'application/json',
    accept: 'application/json',
    'accept-language': 'ru-RU,ru;q=0.9',
    origin: 'https://sipclock.vercel.app',
    'user-agent': 'UA',
    'idempotency-key': 'k1',
    'x-request-id': 'r1',
    host: 'sipclock.vercel.app',
    authorization: 'Bearer nope',
    'accept-encoding': 'gzip',
    'x-forwarded-for': '203.0.113.7',
    'x-sipclock-client-ip': '1.2.3.4',
    'x-sipclock-proxy-secret': 'forged',
  });
  it('forwards only the allowlist and sets proxy-owned headers', () => {
    const out = buildUpstreamHeaders(incoming, { secret: 's3cret' });
    expect([...out.keys()].sort()).toEqual(
      [
        'accept',
        'accept-language',
        'content-type',
        'cookie',
        'idempotency-key',
        'origin',
        'user-agent',
        'x-request-id',
        'x-sipclock-client-ip',
        'x-sipclock-proxy-secret',
      ].sort(),
    );
    expect(out.get('x-sipclock-client-ip')).toBe('203.0.113.7');
    expect(out.get('x-sipclock-proxy-secret')).toBe('s3cret');
  });
  it('never lets a client-supplied secret through when none is configured', () => {
    const out = buildUpstreamHeaders(incoming);
    expect(out.has('x-sipclock-proxy-secret')).toBe(false);
    expect(out.get('x-sipclock-client-ip')).toBe('203.0.113.7');
  });
  it('omits the client ip header when unknown', () => {
    expect(
      buildUpstreamHeaders(new Headers({ 'x-sipclock-client-ip': '1.2.3.4' })).has(
        'x-sipclock-client-ip',
      ),
    ).toBe(false);
  });
});

describe('response headers', () => {
  it('keeps every set-cookie separate and drops transfer headers', () => {
    const upstream = new Headers({
      'content-type': 'application/json',
      'content-encoding': 'gzip',
      'content-length': '12',
      'transfer-encoding': 'chunked',
    });
    upstream.append('set-cookie', 'session=abc; Path=/; HttpOnly; Domain=api.example.com');
    upstream.append('set-cookie', 'other=1; Path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT');
    const out = buildDownstreamHeaders(upstream);
    expect(out.get('content-type')).toBe('application/json');
    expect(out.has('content-encoding')).toBe(false);
    expect(out.has('content-length')).toBe(false);
    expect(out.has('transfer-encoding')).toBe(false);
    expect(out.getSetCookie()).toEqual([
      'session=abc; Path=/; HttpOnly',
      'other=1; Path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT',
    ]);
  });
  it('passes the AI quota header to the browser', () => {
    const out = buildDownstreamHeaders(new Headers({ 'x-ai-quota-remaining': '7' }));
    expect(out.get('x-ai-quota-remaining')).toBe('7');
  });
  it('strips Domain from cookies only', () => {
    expect(rewriteSetCookie('a=b; domain=x.com; Secure')).toBe('a=b; Secure');
    expect(rewriteSetCookie('domain=keep; Path=/')).toBe('domain=keep; Path=/');
  });
});
