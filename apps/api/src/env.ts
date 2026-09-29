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
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  RATE_LIMIT_RECOMMEND_PER_MIN: z.coerce.number().int().min(1).max(100_000).default(60),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
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
