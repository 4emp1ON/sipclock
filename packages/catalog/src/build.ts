import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { catalog } from './index.ts';

export function render(): { catalogJson: string; manifestJson: string } {
  const catalogJson = `${JSON.stringify(catalog, null, 2)}\n`;
  const manifest = {
    version: catalog.version,
    sha256: createHash('sha256').update(catalogJson).digest('hex'),
    recipes: catalog.recipes.length,
    ingredients: catalog.ingredients.length,
    alcoholFree: catalog.recipes.filter((r) =>
      r.ingredients.every(
        (line) => (catalog.ingredients.find((i) => i.id === line.ingredient)?.abv ?? 0) <= 0.5,
      ),
    ).length,
  };
  return { catalogJson, manifestJson: `${JSON.stringify(manifest, null, 2)}\n` };
}

const dir = join(import.meta.dirname, '..', 'generated');
const files = () => {
  const { catalogJson, manifestJson } = render();
  return [
    [join(dir, 'catalog.json'), catalogJson],
    [join(dir, 'manifest.json'), manifestJson],
  ] as const;
};

if (process.argv[1] === import.meta.filename) {
  if (process.argv.includes('--check')) {
    const stale = files().filter(
      ([path, content]) => !existsSync(path) || readFileSync(path, 'utf8') !== content,
    );
    if (stale.length > 0) {
      console.error(
        `Stale generated files: ${stale.map(([p]) => p).join(', ')}\nRun: pnpm --filter @sipclock/catalog build`,
      );
      process.exit(1);
    }
    console.log('generated/* is up to date');
  } else {
    mkdirSync(dir, { recursive: true });
    for (const [path, content] of files()) writeFileSync(path, content);
    console.log(`Wrote ${files().length} files to ${dir}`);
  }
}
