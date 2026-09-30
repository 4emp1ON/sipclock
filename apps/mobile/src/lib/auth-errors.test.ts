import { authErrorMessage, isValidEmail } from './auth-errors';
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
