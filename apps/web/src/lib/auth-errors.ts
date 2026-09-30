export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export type AuthErrorKey =
  | 'invalidEmail'
  | 'invalidCode'
  | 'sendFailed'
  | 'verifyFailed'
  | 'tooMany'
  | 'passwordRequired'
  | 'passwordShort'
  | 'passwordLong'
  | 'passwordCompromised'
  | 'invalidCredentials'
  | 'otpInvalid'
  | 'otpExpired'
  | 'otpTooManyAttempts'
  | 'signInFailed'
  | 'signUpFailed'
  | 'resetFailed';

export interface AuthErrorLike {
  code?: string;
  status?: number;
  message?: string;
}

const BY_CODE: Record<string, AuthErrorKey> = {
  INVALID_EMAIL_OR_PASSWORD: 'invalidCredentials',
  PASSWORD_TOO_SHORT: 'passwordShort',
  PASSWORD_TOO_LONG: 'passwordLong',
  PASSWORD_COMPROMISED: 'passwordCompromised',
  INVALID_OTP: 'otpInvalid',
  OTP_EXPIRED: 'otpExpired',
  TOO_MANY_ATTEMPTS: 'otpTooManyAttempts',
};

/** Maps a Better Auth client error to a message key. Never distinguishes "no such account". */
export function authErrorKey(err: AuthErrorLike, fallback: AuthErrorKey): AuthErrorKey {
  if (err.status === 429) return 'tooMany';
  if (err.code && err.code in BY_CODE) return BY_CODE[err.code] as AuthErrorKey;
  return fallback;
}

export function isEmailNotVerified(err: AuthErrorLike): boolean {
  return err.code === 'EMAIL_NOT_VERIFIED';
}

export function validatePassword(password: string, mode: 'existing' | 'new'): AuthErrorKey | null {
  if (password.length === 0) return 'passwordRequired';
  if (mode === 'existing') return null;
  if (password.length < PASSWORD_MIN) return 'passwordShort';
  if (password.length > PASSWORD_MAX) return 'passwordLong';
  return null;
}
