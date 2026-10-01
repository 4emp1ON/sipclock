import type { NextRequest } from 'next/server';
import {
  buildDownstreamHeaders,
  buildUpstreamHeaders,
  mapProxyPath,
  proxyTimeoutMs,
} from '@/lib/api-proxy';

// Same-origin proxy to the Sipclock API so session cookies are first-party (docs/adr/0006).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// The AI chat streams for up to 60 s (see proxyTimeoutMs); Vercel's default function limit is lower.
export const maxDuration = 60;

// Falls back to the local API only in development; a production deploy without it must fail loudly.
const API_ORIGIN = (
  process.env.API_ORIGIN ?? (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8787')
).replace(/\/+$/, '');

function problem(status: number, title: string) {
  return Response.json(
    { type: 'about:blank', title, status },
    {
      status,
      headers: { 'content-type': 'application/problem+json', 'cache-control': 'no-store' },
    },
  );
}

async function forward(request: NextRequest): Promise<Response> {
  const upstreamPath = mapProxyPath(request.nextUrl.pathname);
  if (!upstreamPath) return problem(404, 'Not found');
  if (!API_ORIGIN) {
    console.error('API proxy: API_ORIGIN is not configured');
    return problem(503, 'The API is not configured');
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  try {
    const upstream = await fetch(`${API_ORIGIN}${upstreamPath}${request.nextUrl.search}`, {
      method: request.method,
      headers: buildUpstreamHeaders(request.headers, { secret: process.env.EDGE_PROXY_SECRET }),
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: 'manual',
      cache: 'no-store',
      // The browser leaving (Stop in the chat) cancels the upstream call too, so the API stops the answer.
      signal: AbortSignal.any([
        request.signal,
        AbortSignal.timeout(proxyTimeoutMs(request.nextUrl.pathname)),
      ]),
    });
    const headers = buildDownstreamHeaders(upstream.headers);
    headers.set('cache-control', 'no-store');
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    // Nobody is waiting for the answer any more.
    if (request.signal.aborted) return new Response(null, { status: 499 });
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return problem(504, 'The API took too long to respond');
    }
    return problem(502, 'The API is unreachable');
  }
}

export { forward as GET, forward as POST };
