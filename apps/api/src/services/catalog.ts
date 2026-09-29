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

/** Production service backed by the generated files of `@sipclock/catalog`. */
export function createBundledCatalogService(): CatalogService {
  const require = createRequire(import.meta.url);
  const bundleJson = readFileSync(require.resolve('@sipclock/catalog/bundle.json'), 'utf8');
  const manifest = JSON.parse(
    readFileSync(require.resolve('@sipclock/catalog/manifest.json'), 'utf8'),
  ) as CatalogManifest;
  return createCatalogService(JSON.parse(bundleJson) as Catalog, { bundleJson, manifest });
}
