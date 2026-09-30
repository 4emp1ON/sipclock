import { type BetterAuthPlugin, betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { haveIBeenPwned } from 'better-auth/plugins/haveibeenpwned';
import { jwt } from 'better-auth/plugins/jwt';
import type { Database } from './db/client.ts';
import * as authSchema from './db/schema/auth.ts';
import type { Env } from './env.ts';
import type { Logger } from './lib/logger.ts';

/** Deep-link scheme of the mobile app (apps/mobile/app.json `expo.scheme`). */
export const MOBILE_SCHEME = 'sipclock://';

export const OTP_LENGTH = 6;
export const OTP_EXPIRES_IN_SECONDS = 5 * 60;
export const OTP_ALLOWED_ATTEMPTS = 3;
/**
 * Per-address limits, enforced in app.ts before Better Auth (its own limiter is off). Codes are created
 * before the email is sent, so limiting only the sending would still let an attacker mint codes to guess.
 */
export const OTP_SENDS_PER_EMAIL = 5;
export const OTP_SEND_WINDOW_MS = 15 * 60_000;
/** Sign-in attempts per address per hour; with 6 digits this keeps guessing hopeless. */
export const OTP_SIGN_INS_PER_EMAIL = 10;
export const OTP_SIGN_IN_WINDOW_MS = 60 * 60_000;

/** Routes that email a code: counted against OTP_SENDS_PER_EMAIL. */
export const EMAIL_SENDING_PATHS = [
  '/api/auth/email-otp/send-verification-otp',
  '/api/auth/email-otp/request-password-reset',
  '/api/auth/forget-password/email-otp',
  '/api/auth/sign-up/email',
] as const;
/** Routes that check a code or a password: counted against OTP_SIGN_INS_PER_EMAIL. */
export const CREDENTIAL_CHECK_PATHS = [
  '/api/auth/sign-in/email-otp',
  '/api/auth/sign-in/email',
  '/api/auth/email-otp/verify-email',
  '/api/auth/email-otp/check-verification-otp',
  '/api/auth/email-otp/reset-password',
] as const;

/** NIST SP 800-63B minimum; enough together with the breach check below. */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export type AuthEnv = Pick<
  Env,
  | 'NODE_ENV'
  | 'BETTER_AUTH_SECRET'
  | 'BETTER_AUTH_URL'
  | 'CORS_ORIGINS'
  | 'EMAIL_FROM'
  | 'POWERSYNC_AUDIENCE'
> &
  Partial<Pick<Env, 'RESEND_API_KEY'>>;

/** Origins Better Auth accepts: web origins, the app scheme and, outside production, Expo Go. */
export function trustedOrigins(env: Pick<Env, 'NODE_ENV' | 'CORS_ORIGINS'>): string[] {
  return [
    ...env.CORS_ORIGINS,
    MOBILE_SCHEME,
    ...(env.NODE_ENV === 'production' ? [] : ['exp://', 'exp://**']),
  ];
}

type OtpType = 'sign-in' | 'email-verification' | 'forget-password' | 'change-email';

const otpSubjects: Record<OtpType, string> = {
  'sign-in': 'Your Sipclock sign-in code',
  'email-verification': 'Verify your Sipclock email',
  'forget-password': 'Reset your Sipclock password',
  'change-email': 'Confirm your new Sipclock email',
};

export function otpEmail(otp: string, type: OtpType): { subject: string; text: string } {
  const minutes = OTP_EXPIRES_IN_SECONDS / 60;
  return {
    subject: otpSubjects[type],
    text: `Your code is ${otp}. It expires in ${minutes} minutes.\n\nIf you did not request it, ignore this email.`,
  };
}

/**
 * Returns the email OTP sender. It never awaits delivery in the request path (the response time must
 * not reveal whether an email exists or how the provider behaved); failures are only logged.
 */
export function createOtpSender(
  env: Pick<AuthEnv, 'NODE_ENV' | 'EMAIL_FROM' | 'RESEND_API_KEY'>,
  logger: Logger,
  fetchImpl: typeof fetch = fetch,
) {
  return async ({ email, otp, type }: { email: string; otp: string; type: OtpType }) => {
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) {
      if (env.NODE_ENV === 'production') {
        logger.error('email otp not sent: RESEND_API_KEY is not configured', { type });
      } else {
        logger.info('email otp (dev)', { email, otp, type });
      }
      return;
    }
    const { subject, text } = otpEmail(otp, type);
    void fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [email], subject, text }),
      signal: AbortSignal.timeout(10_000),
    })
      .then(async (res) => {
        if (!res.ok) {
          logger.error('email otp send failed', {
            type,
            status: res.status,
            body: (await res.text().catch(() => '')).slice(0, 500),
          });
        }
      })
      .catch((error: unknown) => {
        logger.error('email otp send failed', { type, error: String(error) });
      });
  };
}

/**
 * Native apps send no `Origin`; Better Auth's Expo client puts the app scheme in `expo-origin` instead, and
 * this copies it over so the usual trusted-origin check applies. It is the part of `@better-auth/expo`'s
 * server plugin that email sign-in needs; the rest (OAuth helpers, including an open redirect) comes back
 * with social sign-in.
 */
export function nativeAppOrigin(): BetterAuthPlugin {
  return {
    id: 'native-app-origin',
    async onRequest(request) {
      const expoOrigin = request.headers.get('expo-origin');
      if (request.headers.get('origin') || !expoOrigin) return;
      const headers = new Headers(request.headers);
      headers.set('origin', expoOrigin);
      return { request: new Request(request, { headers }) };
    },
  };
}

export function createAuth(db: Database, env: AuthEnv, logger: Logger) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: trustedOrigins(env),
    database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
    // Password accounts work only once the address is confirmed with an emailed code, so nobody can
    // claim someone else's address. Sign-up answers the same for new and taken addresses (no enumeration).
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      revokeSessionsOnPasswordReset: true,
    },
    emailVerification: {
      sendOnSignUp: true,
      // A password sign-in to an unconfirmed account sends a fresh code and answers EMAIL_NOT_VERIFIED.
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
    },
    user: { deleteUser: { enabled: true } },
    // Our own per-IP limiter guards /api/auth/* (see app.ts). Better Auth's limiter keys by
    // X-Forwarded-For, which clients can spoof, and would double-count behind our proxies.
    rateLimit: { enabled: false },
    plugins: [
      emailOTP({
        otpLength: OTP_LENGTH,
        expiresIn: OTP_EXPIRES_IN_SECONDS,
        allowedAttempts: OTP_ALLOWED_ATTEMPTS,
        disableSignUp: false,
        // A resend within the expiry repeats the live code instead of minting another one to guess.
        resendStrategy: 'reuse',
        // Email verification is a 6-digit code (POST /email-otp/verify-email), not a link.
        overrideDefaultEmailVerification: true,
        sendVerificationOTP: createOtpSender(env, logger),
      }),
      // Rejects passwords found in known breaches (k-anonymity range query; only a hash prefix leaves).
      haveIBeenPwned(),
      // Short-lived tokens for the PowerSync service (GET /api/auth/token, keys at /api/auth/jwks).
      jwt({
        jwt: {
          issuer: env.BETTER_AUTH_URL,
          audience: env.POWERSYNC_AUDIENCE,
          expirationTime: '15m',
          // `sub` is the user id; keep personal data out of the token.
          definePayload: () => ({}),
        },
      }),
      nativeAppOrigin(),
    ],
  });
}

export interface AuthSession {
  user: { id: string };
}

/** The only part of Better Auth the HTTP layer depends on (easy to fake in tests). */
export interface AuthHandler {
  handler: (request: Request) => Promise<Response>;
  /** Resolves the session from request headers (cookie or bearer); `null` when signed out. */
  getSession: (headers: Headers) => Promise<AuthSession | null>;
}

export function toAuthHandler(auth: ReturnType<typeof createAuth>): AuthHandler {
  return {
    handler: auth.handler,
    getSession: async (headers) => {
      const session = await auth.api.getSession({ headers });
      return session ? { user: { id: session.user.id } } : null;
    },
  };
}
