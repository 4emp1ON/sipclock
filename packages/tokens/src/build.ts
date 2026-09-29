// Regenerates generated/* from src/tokens.json. `--check` fails if the committed output is stale (used in CI).
import { readFileSync, writeFileSync } from 'node:fs';
import { emitCss, emitTailwindTheme, emitTs, emitUniwind } from './emit.ts';
import { resolve, type TokensSource } from './model.ts';

const root = new URL('../', import.meta.url);
const source = JSON.parse(readFileSync(new URL('src/tokens.json', root), 'utf8')) as TokensSource;
const tokens = resolve(source);

const outputs: Record<string, string> = {
  'generated/tokens.css': emitCss(tokens),
  'generated/theme.css': emitTailwindTheme(tokens),
  'generated/uniwind.css': emitUniwind(tokens),
  'generated/tokens.ts': emitTs(tokens),
};

const check = process.argv.includes('--check');
const stale: string[] = [];
for (const [path, content] of Object.entries(outputs)) {
  const url = new URL(path, root);
  if (check) {
    let current = '';
    try {
      current = readFileSync(url, 'utf8');
    } catch {}
    if (current !== content) stale.push(path);
  } else {
    writeFileSync(url, content);
  }
}

if (stale.length > 0) {
  console.error(`Stale token output: ${stale.join(', ')}. Run \`pnpm tokens\`.`);
  process.exit(1);
}
console.log(check ? 'Token output is up to date.' : `Wrote ${Object.keys(outputs).length} files.`);
