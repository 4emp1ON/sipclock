'use client';

import { useState } from 'react';
import type { Ui } from '@/i18n/ui';

export const inputClass =
  'mt-2 block min-h-12 w-full rounded-md border border-line bg-surface px-4 text-base text-ink placeholder:text-ink-muted';
export const primaryButton =
  'inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-6 font-semibold text-on-primary hover:bg-[var(--primary-pressed)] disabled:opacity-60';
export const secondaryButton =
  'inline-flex min-h-12 items-center justify-center rounded-pill border border-line px-6 font-semibold hover:bg-surface disabled:opacity-60';
export const linkButton =
  'inline-flex min-h-11 items-center text-sm font-semibold underline disabled:no-underline disabled:opacity-60';

export function EmailField({
  value,
  onChange,
  invalid,
  autoComplete,
  label,
  readOnly,
}: {
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
  autoComplete: 'email' | 'username';
  label: string;
  readOnly?: boolean;
}) {
  return (
    <>
      <label htmlFor="email" className="text-sm font-semibold">
        {label}
      </label>
      <input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        required
        readOnly={readOnly}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        className={inputClass}
      />
    </>
  );
}

export function PasswordField({
  ui,
  id = 'password',
  label,
  value,
  onChange,
  autoComplete,
  invalid,
  hint,
}: {
  ui: Ui['auth'];
  id?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
  invalid: boolean;
  hint?: string;
}) {
  const [shown, setShown] = useState(false);
  const hintId = `${id}-hint`;
  return (
    <div className="mt-5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
          aria-describedby={hint ? hintId : undefined}
          className={`${inputClass} pr-24`}
        />
        <button
          type="button"
          aria-pressed={shown}
          aria-label={shown ? ui.hidePassword : ui.showPassword}
          onClick={() => setShown((s) => !s)}
          className="absolute right-1 top-2 inline-flex min-h-12 items-center px-3 text-sm font-semibold underline"
        >
          {shown ? ui.hidePassword.split(' ')[0] : ui.showPassword.split(' ')[0]}
        </button>
      </div>
      {hint && (
        <p id={hintId} className="mt-2 text-sm text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function CodeField({
  label,
  value,
  onChange,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
}) {
  return (
    <>
      <label htmlFor="code" className="mt-5 block text-sm font-semibold">
        {label}
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
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        aria-invalid={invalid}
        className={`${inputClass} tabular tracking-[0.4em]`}
      />
    </>
  );
}
