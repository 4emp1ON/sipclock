import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

const csp = [
  "default-src 'self'",
  // Next injects inline bootstrap scripts; tighten with nonces once dynamic rendering is used.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://*.ingest.us.sentry.io",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig: NextConfig = {
  reactCompiler: true,
  typedRoutes: true,
  transpilePackages: [
    '@sipclock/tokens',
    '@sipclock/domain',
    '@sipclock/catalog',
    '@sipclock/engine',
    '@sipclock/i18n',
  ],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ];
  },
};

// Sentry build plugin (source map upload) only when a token is configured, so offline builds pass.
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
    })
  : nextConfig;
