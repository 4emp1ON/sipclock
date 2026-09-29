import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Catalog } from '@sipclock/domain';
import { createIndex, estimateAbv } from '@sipclock/engine';

export interface CatalogManifest {
  version: string;
  sha256: string;
  recipes: number;
  ingredients: number;
  alcoholFree: number;
}

export interface CatalogService {
  /** Parsed catalog, used by the recommendation engine. */
  readonly catalog: Catalog;
  readonly manifest: CatalogManifest;
  /** Pre-serialized bundle, served verbatim. */
  readonly bundleJson: string;
  /** Strong ETag, quoted. */
  readonly etag: string;
}

function countAlcoholFree(catalog: Catalog): number {
  const index = createIndex(catalog);
  return catalog.recipes.filter((r) => estimateAbv(r, index) === 0).length;
}

/** Builds the service from a parsed catalog (serializes and hashes once). Handy for test fixtures. */
export function createCatalogService(
  catalog: Catalog,
  precomputed?: { bundleJson: string; manifest: CatalogManifest },
): CatalogService {
  const bundleJson = precomputed?.bundleJson ?? JSON.stringify(catalog);
  const manifest: CatalogManifest = precomputed?.manifest ?? {
    version: catalog.version,
    sha256: createHash('sha256').update(bundleJson).digest('hex'),
    recipes: catalog.recipes.length,
    ingredients: catalog.ingredients.length,
    alcoholFree: countAlcoholFree(catalog),
  };
  return { catalog, manifest, bundleJson, etag: `"${manifest.sha256}"` };
}

/**
 * Production service backed by the generated files of `@sipclock/catalog`. `dir` points at a copy of
 * those files (the bundled server image ships them next to the code); otherwise they are resolved from
 * the workspace package.
 */
export function createBundledCatalogService(dir?: string): CatalogService {
  const require = createRequire(import.meta.url);
  const file = (name: 'catalog' | 'manifest') =>
    dir
      ? `${dir}/${name}.json`
      : require.resolve(`@sipclock/catalog/${name === 'catalog' ? 'bundle' : 'manifest'}.json`);
  const bundleJson = readFileSync(file('catalog'), 'utf8');
  const manifest = JSON.parse(readFileSync(file('manifest'), 'utf8')) as CatalogManifest;
  return createCatalogService(JSON.parse(bundleJson) as Catalog, { bundleJson, manifest });
}
