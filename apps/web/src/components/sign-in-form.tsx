'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { getUi, type Locale } from '@/i18n/ui';
import { authClient } from '@/lib/auth-client';
import { safeNextPath } from '@/lib/next-path';

const RESEND_COOLDOWN_S = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass =
  'mt-2 block min-h-12 w-full rounded-md border border-line bg-surface px-4 text-base text-ink placeholder:text-ink-muted';
const primaryButton =
  'inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-6 font-semibold text-on-primary hover:bg-[var(--primary-pressed)] disabled:opacity-60';
const linkButton =
  'inline-flex min-h-11 items-center text-sm font-semibold underline disabled:no-underline disabled:opacity-60';

type ErrorKey = 'invalidEmail' | 'invalidCode' | 'sendFailed' | 'verifyFailed' | 'tooMany';

export function SignInForm({ locale }: { locale: Locale }) {
  const ui = getUi(locale);
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async (address: string): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await authClient.emailOtp.sendVerificationOtp({
        email: address,
        type: 'sign-in',
      });
      if (err) {
        setError(err.status === 429 ? 'tooMany' : 'sendFailed');
        return false;
      }
      setCooldown(RESEND_COOLDOWN_S);
      return true;
    } catch {
      setError('sendFailed');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onEmail = async (e: FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!EMAIL_RE.test(address)) {
      setError('invalidEmail');
      return;
    }
    setEmail(address);
    if (await sendCode(address)) {
      setCode('');
      setStep('code');
    }
  };

  const onCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('invalidCode');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await authClient.signIn.emailOtp({ email, otp: code });
      if (err) {
        setError(err.status === 429 ? 'tooMany' : 'verifyFailed');
        return;
      }
      const next = safeNextPath(new URLSearchParams(window.location.search).get('next'), locale);
      router.replace(next as Route);
    } catch {
      setError('verifyFailed');
    } finally {
      setBusy(false);
    }
  };

  const errorText = error ? ui.auth[error] : null;
  const errorNode = errorText && (
    <p role="alert" className="mt-3 text-sm font-medium text-danger">
      {errorText}
    </p>
  );

  if (step === 'email') {
    return (
      <form onSubmit={onEmail} noValidate className="mt-8 max-w-sm">
        <label htmlFor="email" className="text-sm font-semibold">
          {ui.auth.emailLabel}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error === 'invalidEmail'}
          className={inputClass}
        />
        {errorNode}
        <button type="submit" disabled={busy} className={`${primaryButton} mt-5`}>
          {busy ? ui.auth.sendingCode : ui.auth.sendCode}
        </button>
        <p className="mt-6 text-sm text-ink-muted">{ui.auth.guestNote}</p>
      </form>
    );
  }

  return (
    <form onSubmit={onCode} noValidate className="mt-8 max-w-sm">
      <p className="text-sm text-ink-muted">{ui.auth.codeSent(email)}</p>
      <label htmlFor="code" className="mt-5 block text-sm font-semibold">
        {ui.auth.codeLabel}
      </label>
      <input
        id="code"
        name="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        required
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        aria-invalid={error === 'invalidCode' || error === 'verifyFailed'}
        className={`${inputClass} tabular tracking-[0.4em]`}
      />
      {errorNode}
      <button type="submit" disabled={busy} className={`${primaryButton} mt-5`}>
        {busy ? ui.auth.verifying : ui.auth.verify}
      </button>
      <div className="mt-4 flex flex-wrap gap-x-5">
        <button
          type="button"
          disabled={busy || cooldown > 0}
          onClick={() => void sendCode(email)}
          className={linkButton}
        >
          {cooldown > 0 ? ui.auth.resendIn(cooldown) : ui.auth.resend}
        </button>
        <button
          type="button"
          onClick={() => {
            setStep('email');
            setError(null);
          }}
          className={linkButton}
        >
          {ui.auth.changeEmail}
        </button>
      </div>
    </form>
  );
}
