// Bundles the server and the migration runner into dist/ for the production image.
// Bundling keeps the image free of the workspace's unrelated packages: better-auth's optional peers
// (Next.js, Expo) resolve to the web and mobile apps in the monorepo and would otherwise be installed.
import { build } from 'esbuild';

await build({
  entryPoints: {
    server: 'src/server.ts',
    migrate: 'src/migrate.ts',
    'ai-smoke': 'scripts/ai-smoke.ts',
  },
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  legalComments: 'none',
  // Some CommonJS dependencies call require() at runtime.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  logLevel: 'info',
});
