import { initialMode, isCodeMode, nextMode } from './auth-flow';

describe('nextMode', () => {
  it('keeps the code flow as the default and reaches password mode from it', () => {
    expect(nextMode('email', 'code-sent')).toBe('code');
    expect(nextMode('email', 'use-password')).toBe('password');
    expect(nextMode('password', 'use-code')).toBe('email');
  });

  it('walks sign-up: password -> signup -> confirm', () => {
    expect(nextMode('password', 'create-account')).toBe('signup');
    expect(nextMode('signup', 'code-sent')).toBe('confirm');
    expect(nextMode('confirm', 'change-email')).toBe('signup');
    expect(nextMode('signup', 'back')).toBe('password');
  });

  it('walks password reset: password -> forgot -> reset', () => {
    expect(nextMode('password', 'forgot')).toBe('forgot');
    expect(nextMode('forgot', 'code-sent')).toBe('reset');
    expect(nextMode('reset', 'change-email')).toBe('forgot');
    expect(nextMode('forgot', 'back')).toBe('password');
    expect(nextMode('forgot', 'use-code')).toBe('email');
  });

  it('sends an unverified password sign-in to the confirm step', () => {
    expect(nextMode('password', 'unverified')).toBe('confirm');
  });

  it('ignores events that do not apply', () => {
    expect(nextMode('code', 'create-account')).toBe('code');
    expect(nextMode('email', 'forgot')).toBe('email');
    expect(nextMode('code', 'change-email')).toBe('email');
    expect(nextMode('reset', 'code-sent')).toBe('reset');
  });
});

describe('isCodeMode', () => {
  it('flags the code entry modes', () => {
    expect(['code', 'confirm', 'reset'].every((m) => isCodeMode(m as never))).toBe(true);
    expect(['email', 'password', 'signup', 'forgot'].some((m) => isCodeMode(m as never))).toBe(
      false,
    );
  });
});

describe('initialMode', () => {
  it('starts the reset flow only with mode=reset and an email', () => {
    expect(initialMode({ mode: 'reset', email: ' Me@Example.com ' })).toEqual({
      mode: 'forgot',
      email: 'me@example.com',
      autoSend: true,
    });
    expect(initialMode({ mode: 'reset' }).mode).toBe('email');
    expect(initialMode({}).autoSend).toBe(false);
  });
});
