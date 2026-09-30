/**
 * Sign-in modal modes. `email`/`code` is the passwordless default; the rest is the password flow.
 *
 * email    -> enter the address for a one-time code
 * code     -> enter the emailed sign-in code
 * password -> email + password
 * signup   -> email + new password
 * confirm  -> enter the emailed code that verifies the address
 * forgot   -> enter the address to receive a password-reset code
 * reset    -> enter the reset code + new password
 */
export type AuthMode = 'email' | 'code' | 'password' | 'signup' | 'confirm' | 'forgot' | 'reset';

export type AuthEvent =
  | 'use-password'
  | 'use-code'
  | 'create-account'
  | 'forgot'
  | 'code-sent'
  | 'unverified'
  | 'change-email'
  | 'back';

/** Next mode for an event; unknown combinations keep the current mode. */
export function nextMode(mode: AuthMode, event: AuthEvent): AuthMode {
  switch (event) {
    case 'use-password':
      return mode === 'email' ? 'password' : mode;
    case 'use-code':
      return mode === 'password' || mode === 'signup' || mode === 'forgot' ? 'email' : mode;
    case 'create-account':
      return mode === 'password' ? 'signup' : mode;
    case 'forgot':
      return mode === 'password' ? 'forgot' : mode;
    case 'code-sent':
      if (mode === 'email') return 'code';
      if (mode === 'signup') return 'confirm';
      if (mode === 'forgot') return 'reset';
      return mode;
    case 'unverified':
      return mode === 'password' ? 'confirm' : mode;
    case 'change-email':
      if (mode === 'code') return 'email';
      if (mode === 'confirm') return 'signup';
      if (mode === 'reset') return 'forgot';
      return mode;
    case 'back':
      return mode === 'signup' || mode === 'forgot' ? 'password' : mode;
  }
}

/** Modes that show the code entry (with or without a password field). */
export const isCodeMode = (mode: AuthMode) =>
  mode === 'code' || mode === 'confirm' || mode === 'reset';

/** Route params `?mode=reset&email=…` start the password-reset flow for a known address. */
export function initialMode(params: { mode?: string | string[]; email?: string | string[] }): {
  mode: AuthMode;
  email: string;
  autoSend: boolean;
} {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const email = one(params.email).trim().toLowerCase();
  if (one(params.mode) === 'reset' && email) return { mode: 'forgot', email, autoSend: true };
  return { mode: 'email', email: '', autoSend: false };
}

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
