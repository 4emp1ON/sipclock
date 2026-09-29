import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { catalog as catalogSchema } from '@sipclock/domain';
import { compress } from 'hono/compress';
import { validationHook } from '../middleware/error-handling.ts';
import type { CatalogService } from '../services/catalog.ts';
import type { AppEnv } from '../types.ts';

export const CATALOG_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=86400';

const manifestSchema = z
  .object({
    version: z.string().meta({ example: '2026.09.29' }),
    sha256: z.string().meta({ description: 'SHA-256 of the bundle; also its ETag.' }),
    recipes: z.number().int(),
    ingredients: z.number().int(),
    alcoholFree: z.number().int().meta({ description: 'Recipes with an estimated ABV of 0.' }),
  })
  .meta({ id: 'CatalogManifest' });

const manifestRoute = createRoute({
  method: 'get',
  path: '/v1/catalog/manifest',
  tags: ['catalog'],
  summary: 'Catalog version, checksum and counts',
  responses: {
    200: {
      description: 'Manifest',
      content: { 'application/json': { schema: manifestSchema } },
    },
  },
});

const bundleRoute = createRoute({
  method: 'get',
  path: '/v1/catalog',
  tags: ['catalog'],
  summary: 'Full catalog bundle (ingredients and recipes)',
  description:
    'Strong ETag equal to the manifest sha256. Send `If-None-Match` to get 304. Cacheable for 5 minutes.',
  request: {
    headers: z.object({
      'if-none-match': z.string().optional().meta({ description: 'ETag from a previous response' }),
    }),
  },
  responses: {
    200: {
      description: 'Catalog bundle',
      headers: z.object({
        ETag: z.string(),
        'Cache-Control': z.string().meta({ example: CATALOG_CACHE_CONTROL }),
      }),
      content: { 'application/json': { schema: catalogSchema.meta({ id: 'Catalog' }) } },
    },
    304: { description: 'Not modified (ETag matched)' },
  },
});

/** True when an `If-None-Match` header (weak comparison, list or `*`) matches the ETag. */
export function etagMatches(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  if (header.trim() === '*') return true;
  const strip = (v: string) => v.trim().replace(/^W\//, '');
  return header.split(',').some((candidate) => strip(candidate) === etag);
}

export function createCatalogRouter(deps: { catalog: CatalogService }) {
  const router = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });
  const { catalog } = deps;
  const body = new TextEncoder().encode(catalog.bundleJson);

  // gzip/deflate via Accept-Encoding; the bundle is large and highly compressible.
  router.use('/v1/catalog', compress());

  router.openapi(manifestRoute, (c) => {
    c.header('Cache-Control', CATALOG_CACHE_CONTROL);
    return c.json(catalog.manifest, 200);
  });

  router.openapi(bundleRoute, (c) => {
    const base = { ETag: catalog.etag, 'Cache-Control': CATALOG_CACHE_CONTROL };
    if (etagMatches(c.req.header('if-none-match'), catalog.etag)) {
      return new Response(null, { status: 304, headers: base }) as never;
    }
    return new Response(body, {
      status: 200,
      headers: {
        ...base,
        'Content-Type': 'application/json',
        'Content-Length': String(body.byteLength),
      },
    }) as never;
  });

  return router;
}
