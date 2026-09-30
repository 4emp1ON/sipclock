import type { Strings } from './strings';

export interface AuthErrorLike {
  code?: string | undefined;
  status?: number | undefined;
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (email: string) => EMAIL_PATTERN.test(email.trim());

/** User-facing message for a Better Auth error (`{ code, status }`) or a thrown network failure. */
export function authErrorMessage(error: AuthErrorLike | unknown, s: Strings): string {
  const e = (error ?? {}) as AuthErrorLike;
  if (error instanceof TypeError || e.status === 0) return s.errNetwork;
  if (e.status === 429) return s.errRateLimited;
  switch (e.code) {
    case 'INVALID_OTP':
      return s.errInvalidCode;
    case 'OTP_EXPIRED':
      return s.errExpiredCode;
    case 'TOO_MANY_ATTEMPTS':
      return s.errTooManyAttempts;
    case 'INVALID_EMAIL':
      return s.errInvalidEmail;
    case 'SESSION_EXPIRED':
      return s.errReauth;
  }
  return s.errGeneric;
}
