import { describe, expect, it } from 'vitest';
import { authErrorKey, isEmailNotVerified, validatePassword } from './auth-errors';

describe('authErrorKey', () => {
  it('maps known codes', () => {
    expect(authErrorKey({ code: 'INVALID_EMAIL_OR_PASSWORD', status: 401 }, 'signInFailed')).toBe(
      'invalidCredentials',
    );
    expect(authErrorKey({ code: 'PASSWORD_COMPROMISED', status: 400 }, 'signUpFailed')).toBe(
      'passwordCompromised',
    );
    expect(authErrorKey({ code: 'OTP_EXPIRED' }, 'verifyFailed')).toBe('otpExpired');
    expect(authErrorKey({ code: 'INVALID_OTP' }, 'verifyFailed')).toBe('otpInvalid');
    expect(authErrorKey({ code: 'TOO_MANY_ATTEMPTS' }, 'verifyFailed')).toBe('otpTooManyAttempts');
    expect(authErrorKey({ code: 'PASSWORD_TOO_SHORT' }, 'resetFailed')).toBe('passwordShort');
    expect(authErrorKey({ code: 'PASSWORD_TOO_LONG' }, 'resetFailed')).toBe('passwordLong');
  });

  it('treats 429 as rate limiting whatever the code', () => {
    expect(authErrorKey({ status: 429, code: 'INVALID_OTP' }, 'verifyFailed')).toBe('tooMany');
  });

  it('falls back for unknown errors', () => {
    expect(authErrorKey({ status: 500 }, 'sendFailed')).toBe('sendFailed');
    expect(authErrorKey({ code: 'USER_ALREADY_EXISTS' }, 'signUpFailed')).toBe('signUpFailed');
  });
});

describe('isEmailNotVerified', () => {
  it('matches only EMAIL_NOT_VERIFIED', () => {
    expect(isEmailNotVerified({ code: 'EMAIL_NOT_VERIFIED', status: 403 })).toBe(true);
    expect(isEmailNotVerified({ code: 'INVALID_EMAIL_OR_PASSWORD' })).toBe(false);
  });
});

describe('validatePassword', () => {
  it('requires a password to sign in but not a length', () => {
    expect(validatePassword('', 'existing')).toBe('passwordRequired');
    expect(validatePassword('x', 'existing')).toBeNull();
  });
  it('enforces 8 to 128 characters for new passwords', () => {
    expect(validatePassword('1234567', 'new')).toBe('passwordShort');
    expect(validatePassword('12345678', 'new')).toBeNull();
    expect(validatePassword('a'.repeat(128), 'new')).toBeNull();
    expect(validatePassword('a'.repeat(129), 'new')).toBe('passwordLong');
  });
});
