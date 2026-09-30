import { authErrorMessage, isEmailNotVerified, isValidEmail } from './auth-errors';
import { strings } from './strings';

const s = strings.en;

describe('authErrorMessage', () => {
  it('maps email OTP error codes', () => {
    expect(authErrorMessage({ code: 'INVALID_OTP', status: 400 }, s)).toBe(s.errInvalidCode);
    expect(authErrorMessage({ code: 'OTP_EXPIRED', status: 400 }, s)).toBe(s.errExpiredCode);
    expect(authErrorMessage({ code: 'TOO_MANY_ATTEMPTS', status: 403 }, s)).toBe(
      s.errTooManyAttempts,
    );
    expect(authErrorMessage({ code: 'SESSION_EXPIRED', status: 400 }, s)).toBe(s.errReauth);
  });

  it('maps password error codes', () => {
    expect(authErrorMessage({ code: 'INVALID_EMAIL_OR_PASSWORD', status: 401 }, s)).toBe(
      s.errInvalidCredentials,
    );
    expect(authErrorMessage({ code: 'EMAIL_NOT_VERIFIED', status: 403 }, s)).toBe(
      s.errEmailNotVerified,
    );
    expect(authErrorMessage({ code: 'PASSWORD_TOO_SHORT', status: 400 }, s)).toBe(
      s.errPasswordShort,
    );
    expect(authErrorMessage({ code: 'PASSWORD_TOO_LONG', status: 400 }, s)).toBe(s.errPasswordLong);
    expect(authErrorMessage({ code: 'PASSWORD_COMPROMISED', status: 400 }, s)).toBe(
      s.errPasswordCompromised,
    );
    expect(authErrorMessage({ code: 'INVALID_EMAIL_OR_PASSWORD' }, strings.ru)).toBe(
      strings.ru.errInvalidCredentials,
    );
  });

  it('never mentions whether an address has an account', () => {
    expect(s.errInvalidCredentials).not.toMatch(/no account|not found|exist|registered/i);
    expect(strings.ru.errInvalidCredentials).not.toMatch(/не найден|не существует|зарегистр/i);
  });

  it('maps rate limits, network failures and unknown errors', () => {
    expect(authErrorMessage({ status: 429 }, s)).toBe(s.errRateLimited);
    expect(authErrorMessage(new TypeError('Network request failed'), s)).toBe(s.errNetwork);
    expect(authErrorMessage({ status: 500 }, s)).toBe(s.errGeneric);
    expect(authErrorMessage(undefined, s)).toBe(s.errGeneric);
  });
});

describe('isValidEmail', () => {
  it('accepts plain addresses and rejects obvious typos', () => {
    expect(isValidEmail(' me@example.com ')).toBe(true);
    expect(isValidEmail('me@example')).toBe(false);
    expect(isValidEmail('me example.com')).toBe(false);
  });
});

describe('isEmailNotVerified', () => {
  it('detects the unverified-email code', () => {
    expect(isEmailNotVerified({ code: 'EMAIL_NOT_VERIFIED', status: 403 })).toBe(true);
    expect(isEmailNotVerified({ code: 'INVALID_OTP' })).toBe(false);
    expect(isEmailNotVerified(undefined)).toBe(false);
  });
});
