// Runs every eval suite in turn and fails if any fails. `--output <file>` writes one file per suite
// (`<name>-<suite>.<ext>`); other arguments go to `promptfoo eval` unchanged.
import { spawnSync } from 'node:child_process';
import { parse } from 'node:path';

const suites = ['substitutes', 'chat'];
const args = process.argv.slice(2);
const mock = process.env.EVALS_MOCK === '1';

let status = 0;
for (const suite of suites) {
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? '';
    if (arg === '--output' || arg === '-o') {
      const { dir, name, ext } = parse(args[++i] ?? 'evals-results.json');
      rest.push('-o', `${dir ? `${dir}/` : ''}${name}-${suite}${ext}`);
    } else rest.push(arg);
  }
  console.log(`\n=== evals: ${suite} ===`);
  const run = spawnSync(
    'pnpm',
    [
      'exec',
      'promptfoo',
      'eval',
      '-c',
      `evals/${suite}/promptfooconfig.yaml`,
      '--no-share',
      ...(mock ? ['--no-cache'] : []),
      ...rest,
    ],
    { stdio: 'inherit' },
  );
  if (run.status !== 0) status = run.status ?? 1;
}
process.exit(status);
