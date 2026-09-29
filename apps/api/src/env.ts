import { z } from 'zod';

const csv = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0),
);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  DATABASE_URL: z
    .string()
    .min(1)
    .regex(/^postgres(ql)?:\/\//, 'must be a postgres:// URL'),
  BETTER_AUTH_SECRET: z.string().min(32, 'must be at least 32 characters'),
  BETTER_AUTH_URL: z.url(),
  CORS_ORIGINS: csv.default(['http://localhost:3000', 'http://localhost:8081']),
  SENTRY_DSN: z.preprocess((v) => (v === '' ? undefined : v), z.url().optional()),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  RATE_LIMIT_RECOMMEND_PER_MIN: z.coerce.number().int().min(1).max(100_000).default(60),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
  /** Public URL the API is reached at (e.g. behind a path prefix); used as the OpenAPI server. */
  PUBLIC_BASE_URL: z.preprocess((v) => (v === '' ? undefined : v), z.url().optional()),
  /**
   * Credentials for /docs and /openapi.json (HTTP Basic). In production the docs are not served
   * at all unless both are set.
   */
  API_DOCS_USERNAME: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  API_DOCS_PASSWORD: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(16, 'must be at least 16 characters').optional(),
  ),
});

export type Env = z.infer<typeof envSchema>;

/** Parses and validates environment variables; throws a readable error on failure. */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return result.data;
}
