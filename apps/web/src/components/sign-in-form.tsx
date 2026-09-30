'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { getUi, type Locale } from '@/i18n/ui';
import { authClient } from '@/lib/auth-client';
import {
  type AuthErrorKey,
  authErrorKey,
  isEmailNotVerified,
  validatePassword,
} from '@/lib/auth-errors';
import { safeNextPath } from '@/lib/next-path';
import { CodeField, EmailField, linkButton, PasswordField, primaryButton } from './auth-fields';

const RESEND_COOLDOWN_S = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * code-email -> code-verify: passwordless (default).
 * password / signup / forgot: email + password forms.
 * confirm-email: 6-digit code after sign-up or an unverified sign-in.
 * reset: code + new password.
 */
export type View =
  | 'code-email'
  | 'code-verify'
  | 'password'
  | 'signup'
  | 'confirm-email'
  | 'forgot'
  | 'reset';

interface Props {
  locale: Locale;
  /** Signed-in "set password" flow: email is fixed, a reset code is sent on mount. */
  resetFor?: string;
  /** Called after a successful reset-and-sign-in instead of redirecting. */
  onDone?: () => void;
}

export function SignInForm({ locale, resetFor, onDone }: Props) {
  const ui = getUi(locale);
  const router = useRouter();
  const [view, setView] = useState<View>(resetFor ? 'reset' : 'code-email');
  const [email, setEmail] = useState(resetFor ?? '');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [notVerified, setNotVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const go = (v: View) => {
    setView(v);
    setError(null);
    setNotVerified(false);
    setCode('');
    setPassword('');
  };

  const finish = () => {
    if (onDone) {
      onDone();
      return;
    }
    const next = safeNextPath(new URLSearchParams(window.location.search).get('next'), locale);
    router.replace(next as Route);
  };

  // Runs `call`, mapping a returned or thrown failure to an error key. True on success.
  const attempt = async (
    call: () => Promise<{ error: { code?: string; status?: number } | null }>,
    fallback: AuthErrorKey,
    onError?: (err: { code?: string; status?: number }) => boolean,
  ): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await call();
      if (err) {
        if (!onError?.(err)) setError(authErrorKey(err, fallback));
        return false;
      }
      return true;
    } catch {
      setError(fallback);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const sendFor = (v: View, address: string) => {
    if (v === 'confirm-email') {
      return authClient.emailOtp.sendVerificationOtp({
        email: address,
        type: 'email-verification',
      });
    }
    if (v === 'reset' || v === 'forgot')
      return authClient.emailOtp.requestPasswordReset({ email: address });
    return authClient.emailOtp.sendVerificationOtp({ email: address, type: 'sign-in' });
  };

  const sendCode = async (v: View, address: string): Promise<boolean> => {
    const ok = await attempt(() => sendFor(v, address), 'sendFailed');
    if (ok) setCooldown(RESEND_COOLDOWN_S);
    return ok;
  };

  // Account page: send the reset code once on mount.
  useEffect(() => {
    if (!resetFor || started.current) return;
    started.current = true;
    void sendCode('reset', resetFor);
    // biome-ignore lint/correctness/useExhaustiveDependencies: one-shot on mount
  }, [resetFor, sendCode]);

  const checkEmail = (): string | null => {
    const address = email.trim();
    if (!EMAIL_RE.test(address)) {
      setError('invalidEmail');
      return null;
    }
    setEmail(address);
    return address;
  };

  const checkCode = (): boolean => {
    if (!/^\d{6}$/.test(code)) {
      setError('invalidCode');
      return false;
    }
    return true;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (view === 'code-email') {
      const address = checkEmail();
      if (address && (await sendCode('code-email', address))) {
        go('code-verify');
        setCooldown(RESEND_COOLDOWN_S);
      }
    } else if (view === 'code-verify') {
      if (!checkCode()) return;
      const ok = await attempt(
        () => authClient.signIn.emailOtp({ email, otp: code }),
        'verifyFailed',
      );
      if (ok) finish();
    } else if (view === 'password') {
      const address = checkEmail();
      if (!address) return;
      const invalid = validatePassword(password, 'existing');
      if (invalid) return setError(invalid);
      const ok = await attempt(
        () => authClient.signIn.email({ email: address, password }),
        'signInFailed',
        (err) => {
          if (!isEmailNotVerified(err)) return false;
          // The server has just emailed a fresh code.
          go('confirm-email');
          setNotVerified(true);
          setCooldown(RESEND_COOLDOWN_S);
          return true;
        },
      );
      if (ok) finish();
    } else if (view === 'signup') {
      const address = checkEmail();
      if (!address) return;
      const invalid = validatePassword(password, 'new');
      if (invalid) return setError(invalid);
      const ok = await attempt(
        () => authClient.signUp.email({ email: address, password, name: '' }),
        'signUpFailed',
      );
      if (ok) {
        go('confirm-email');
        setCooldown(RESEND_COOLDOWN_S);
      }
    } else if (view === 'confirm-email') {
      if (!checkCode()) return;
      const ok = await attempt(
        () => authClient.emailOtp.verifyEmail({ email, otp: code }),
        'verifyFailed',
      );
      if (ok) finish();
    } else if (view === 'forgot') {
      const address = checkEmail();
      if (address && (await sendCode('forgot', address))) {
        go('reset');
        setCooldown(RESEND_COOLDOWN_S);
      }
    } else if (view === 'reset') {
      if (!checkCode()) return;
      const invalid = validatePassword(password, 'new');
      if (invalid) return setError(invalid);
      const reset = await attempt(
        () => authClient.emailOtp.resetPassword({ email, otp: code, password }),
        'resetFailed',
      );
      if (!reset) return;
      // Sessions were revoked; sign in with the new password.
      const ok = await attempt(() => authClient.signIn.email({ email, password }), 'signInFailed');
      if (ok) finish();
      else if (!resetFor) setView('password');
    }
  };

  const errorText = error ? ui.auth[error] : null;
  const errorNode = errorText && (
    <p role="alert" className="mt-3 text-sm font-medium text-danger">
      {errorText}
    </p>
  );
  const link = (label: string, to: View) => (
    <button type="button" onClick={() => go(to)} className={linkButton}>
      {label}
    </button>
  );
  const emailField = (autoComplete: 'email' | 'username') => (
    <EmailField
      value={email}
      onChange={setEmail}
      invalid={error === 'invalidEmail'}
      autoComplete={autoComplete}
      label={ui.auth.emailLabel}
    />
  );
  const passwordInvalid =
    error === 'passwordRequired' ||
    error === 'passwordShort' ||
    error === 'passwordLong' ||
    error === 'passwordCompromised' ||
    error === 'invalidCredentials';
  const codeInvalid =
    error === 'invalidCode' ||
    error === 'verifyFailed' ||
    error === 'otpInvalid' ||
    error === 'otpExpired' ||
    error === 'otpTooManyAttempts';
  const submit = (idle: string, pending: string) => (
    <button type="submit" disabled={busy} className={`${primaryButton} mt-5`}>
      {busy ? pending : idle}
    </button>
  );
  const links = (...items: ReactNode[]) => (
    <div className="mt-4 flex flex-wrap gap-x-5">{items}</div>
  );
  const resend = (
    <button
      key="resend"
      type="button"
      disabled={busy || cooldown > 0}
      onClick={() => void sendCode(view, email)}
      className={linkButton}
    >
      {cooldown > 0 ? ui.auth.resendIn(cooldown) : ui.auth.resend}
    </button>
  );

  let body: ReactNode;
  switch (view) {
    case 'code-email':
      body = (
        <>
          {emailField('email')}
          {errorNode}
          {submit(ui.auth.sendCode, ui.auth.sendingCode)}
          {links(link(ui.auth.usePassword, 'password'))}
          <p className="mt-2 text-sm text-ink-muted">{ui.auth.guestNote}</p>
        </>
      );
      break;
    case 'code-verify':
      body = (
        <>
          <p className="text-sm text-ink-muted">{ui.auth.codeSent(email)}</p>
          <CodeField
            label={ui.auth.codeLabel}
            value={code}
            onChange={setCode}
            invalid={codeInvalid}
          />
          {errorNode}
          {submit(ui.auth.verify, ui.auth.verifying)}
          {links(resend, link(ui.auth.changeEmail, 'code-email'))}
        </>
      );
      break;
    case 'password':
      body = (
        <>
          {emailField('username')}
          <PasswordField
            ui={ui.auth}
            label={ui.auth.passwordLabel}
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            invalid={passwordInvalid}
          />
          {errorNode}
          {submit(ui.auth.signInButton, ui.auth.signingIn)}
          {links(
            link(ui.auth.forgotPassword, 'forgot'),
            link(ui.auth.createAccount, 'signup'),
            link(ui.auth.useCode, 'code-email'),
          )}
        </>
      );
      break;
    case 'signup':
      body = (
        <>
          {emailField('username')}
          <PasswordField
            ui={ui.auth}
            label={ui.auth.passwordLabel}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            invalid={passwordInvalid}
            hint={ui.auth.passwordHint}
          />
          {errorNode}
          {submit(ui.auth.createAccount, ui.auth.creatingAccount)}
          {links(link(ui.auth.haveAccount, 'password'), link(ui.auth.useCode, 'code-email'))}
        </>
      );
      break;
    case 'confirm-email':
      body = (
        <>
          <h2 className="font-display text-xl font-semibold">{ui.auth.confirmTitle}</h2>
          <p className="mt-2 text-sm text-ink-muted">
            {notVerified ? ui.auth.confirmFirst : ui.auth.codeSent(email)}
          </p>
          <CodeField
            label={ui.auth.codeLabel}
            value={code}
            onChange={setCode}
            invalid={codeInvalid}
          />
          {errorNode}
          {submit(ui.auth.confirm, ui.auth.verifying)}
          {links(resend, link(ui.auth.changeEmail, 'password'))}
        </>
      );
      break;
    case 'forgot':
      body = (
        <>
          <h2 className="font-display text-xl font-semibold">{ui.auth.resetTitle}</h2>
          <p className="mt-2 text-sm text-ink-muted">{ui.auth.resetLead}</p>
          <div className="mt-5">{emailField('username')}</div>
          {errorNode}
          {submit(ui.auth.sendCode, ui.auth.sendingCode)}
          {links(link(ui.auth.backToSignIn, 'password'))}
        </>
      );
      break;
    case 'reset':
      body = (
        <>
          <h2 className="font-display text-xl font-semibold">{ui.auth.resetTitle}</h2>
          <p className="mt-2 text-sm text-ink-muted">{ui.auth.codeSent(email)}</p>
          <CodeField
            label={ui.auth.codeLabel}
            value={code}
            onChange={setCode}
            invalid={codeInvalid}
          />
          <PasswordField
            ui={ui.auth}
            id="new-password"
            label={ui.auth.newPasswordLabel}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            invalid={passwordInvalid}
            hint={ui.auth.passwordHint}
          />
          {errorNode}
          {submit(ui.auth.setPassword, ui.auth.settingPassword)}
          {links(resend, !resetFor && link(ui.auth.changeEmail, 'forgot'))}
        </>
      );
      break;
  }

  return (
    <form onSubmit={onSubmit} noValidate className={resetFor ? 'mt-4 max-w-sm' : 'mt-8 max-w-sm'}>
      {body}
    </form>
  );
}
