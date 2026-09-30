import { z } from 'zod';

/** Treats an empty variable as unset, so defaults and `optional()` apply. */
const unsetIfEmpty = (v: unknown) => (v === '' ? undefined : v);

const csv = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0),
);

export const envSchema = z
  .object({
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
    API_DOCS_USERNAME: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().min(1).optional(),
    ),
    API_DOCS_PASSWORD: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().min(16, 'must be at least 16 characters').optional(),
    ),
    /** Resend API key for email sign-in codes. Unset: codes are logged outside production, not sent. */
    RESEND_API_KEY: z.preprocess(unsetIfEmpty, z.string().min(1).optional()),
    /** Sender of sign-in code emails (a domain verified in Resend). */
    EMAIL_FROM: z.preprocess(
      unsetIfEmpty,
      z.string().min(3).default('Sipclock <onboarding@resend.dev>'),
    ),
    /** `aud` of the JWTs Better Auth issues for the PowerSync service. */
    POWERSYNC_AUDIENCE: z.preprocess(unsetIfEmpty, z.string().min(1).default('sipclock-powersync')),
    /**
     * Shared secret of the web app's server-side proxy. When a request carries it in
     * `X-Sipclock-Proxy-Secret`, `X-Sipclock-Client-Ip` is trusted as the client address.
     */
    EDGE_PROXY_SECRET: z.preprocess(
      unsetIfEmpty,
      z.string().min(32, 'must be at least 32 characters').optional(),
    ),
  })
  // Without these production looks healthy but nobody can sign in (codes are never sent), and every web
  // user shares the rate limits of the web host's egress IP.
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    for (const key of ['RESEND_API_KEY', 'EDGE_PROXY_SECRET'] as const) {
      if (env[key] === undefined) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'is required in production' });
      }
    }
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
