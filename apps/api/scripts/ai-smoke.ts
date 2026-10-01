// Live check of the AI path against the configured providers, without a database or a session: the real
// registry, gateway, substitutes service and output guard, with an in-memory store. Runs where the provider
// keys live: `docker compose exec api node dist/ai-smoke.js` on the server (bundled by scripts/bundle.ts).
import { createAiGateway } from '../src/ai/gateway.ts';
import { createModelRegistry } from '../src/ai/providers.ts';
import { createMemoryAiStore } from '../src/ai/store.ts';
import { parseEnv } from '../src/env.ts';
import { createLogger } from '../src/lib/logger.ts';
import { createBundledCatalogService } from '../src/services/catalog.ts';
import { createSubstitutesService, type SubstitutesQuery } from '../src/services/substitutes.ts';

const env = parseEnv();
const store = createMemoryAiStore();
const gateway = createAiGateway({
  registry: createModelRegistry(env),
  store,
  logger: createLogger('info'),
  dailyLimits: { free: 100 },
});
const service = createSubstitutesService(
  createBundledCatalogService(process.env.CATALOG_DIR),
  gateway,
);

const cases: SubstitutesQuery[] = [
  { recipeId: 'negroni', ingredientId: 'gin', bar: ['vodka', 'sweet-vermouth'], locale: 'en' },
  { recipeId: 'daiquiri', ingredientId: 'lime-juice', bar: ['lemon', 'white-rum'], locale: 'ru' },
  { recipeId: 'whiskey-sour', ingredientId: 'bourbon', bar: [], locale: 'ru' },
  { recipeId: 'margarita', ingredientId: 'orange-liqueur', bar: ['blanco-tequila'], locale: 'en' },
];

let failures = 0;
for (const query of cases) {
  // Unknown country: the gateway routes to Yandex, as for any user it cannot place.
  const out = await service.suggest(query, {
    userId: 'smoke',
    country: undefined,
    locale: query.locale,
    requestId: `smoke-${query.recipeId}`,
  });
  console.log(
    JSON.stringify({ query: `${query.recipeId}/${query.ingredientId}/${query.locale}`, out }),
  );
  if (!out.ok || out.result.source !== 'ai') failures++;
}
console.log(
  JSON.stringify({ usage: [...store.usage.values()], spend: Object.fromEntries(store.spend) }),
);
process.exit(failures === 0 ? 0 : 1);
