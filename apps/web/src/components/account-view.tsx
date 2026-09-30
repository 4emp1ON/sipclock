'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SignInForm } from '@/components/sign-in-form';
import { getUi, type Locale } from '@/i18n/ui';
import { authClient } from '@/lib/auth-client';
import { recipeName } from '@/lib/catalog';
import { useUserData } from '@/lib/use-user-data';

const secondaryButton =
  'inline-flex min-h-12 items-center justify-center rounded-pill border border-line px-6 font-semibold hover:bg-surface disabled:opacity-60';

export function AccountView({ locale }: { locale: Locale }) {
  const ui = getUi(locale);
  const router = useRouter();
  const { data, isPending } = authClient.useSession();
  const { history, ready, error } = useUserData();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<'out' | 'delete' | null>(null);
  const [deleteFailed, setDeleteFailed] = useState<'failed' | 'code' | null>(null);
  // Deleting needs a session younger than a day; an older one re-confirms with an email code first.
  const [reauth, setReauth] = useState(false);
  const [code, setCode] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);

  if (isPending) return <p className="mt-8 text-ink-muted">…</p>;
  if (!data) {
    return (
      <div className="mt-8">
        <p className="text-ink-muted">{ui.account.signedOut}</p>
        <Link
          href={`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/account`)}` as Route}
          className="mt-4 inline-flex min-h-12 items-center rounded-pill bg-primary px-6 font-semibold text-on-primary hover:bg-[var(--primary-pressed)]"
        >
          {ui.account.signIn}
        </Link>
      </div>
    );
  }

  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

  const signOut = async () => {
    setBusy('out');
    try {
      await authClient.signOut();
      router.replace(`/${locale}` as Route);
    } finally {
      setBusy(null);
    }
  };

  const deleteAccount = async () => {
    setBusy('delete');
    setDeleteFailed(null);
    try {
      if (reauth) {
        const { error: err } = await authClient.signIn.emailOtp({
          email: data.user.email,
          otp: code,
        });
        if (err) {
          setDeleteFailed('code');
          return;
        }
      }
      const { error: err } = await authClient.deleteUser();
      if (err?.code === 'SESSION_EXPIRED' && !reauth) {
        await authClient.emailOtp.sendVerificationOtp({ email: data.user.email, type: 'sign-in' });
        setReauth(true);
        return;
      }
      if (err) {
        setDeleteFailed('failed');
        return;
      }
      router.replace(`/${locale}` as Route);
    } catch {
      setDeleteFailed('failed');
    } finally {
      setBusy(null);
    }
  };

  const cancelDelete = () => {
    setConfirming(false);
    setDeleteFailed(null);
    setReauth(false);
    setCode('');
  };

  return (
    <div className="mt-8 max-w-2xl">
      <dl className="rounded-md bg-surface p-5">
        <dt className="text-sm font-semibold text-ink-muted">{ui.account.email}</dt>
        <dd data-testid="account-email" className="mt-1 break-all text-lg">
          {data.user.email}
        </dd>
      </dl>

      <h2 className="mt-10 font-display text-xl font-semibold">{ui.account.history}</h2>
      {!ready ? (
        <p className="mt-4 text-ink-muted">…</p>
      ) : history.length === 0 ? (
        <p className="mt-4 text-ink-muted">
          {error === 'load' ? ui.account.loadFailed : ui.account.historyEmpty}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {history.map((h) => (
            <li key={h.id}>
              <Link
                href={`/${locale}/recipes/${h.recipeId}` as Route}
                className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md bg-surface px-4 py-3 hover:bg-surface-raised"
              >
                <span className="font-semibold">{recipeName(h.recipeId, locale)}</span>
                <time
                  dateTime={new Date(h.madeAt).toISOString()}
                  className="tabular text-sm text-ink-muted"
                >
                  {dateFormat.format(new Date(h.madeAt))}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10">
        <button
          type="button"
          onClick={() => setSettingPassword((v) => !v)}
          aria-expanded={settingPassword}
          className={secondaryButton}
        >
          {ui.account.setPassword}
        </button>
        {settingPassword && (
          <div className="mt-4">
            <p className="text-sm text-ink-muted">{ui.account.setPasswordLead}</p>
            <SignInForm
              locale={locale}
              resetFor={data.user.email}
              onDone={() => setSettingPassword(false)}
            />
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={signOut}
          disabled={busy !== null}
          className={secondaryButton}
        >
          {ui.account.signOut}
        </button>
        {!confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex min-h-12 items-center justify-center rounded-pill px-6 font-semibold text-danger underline"
          >
            {ui.account.deleteAccount}
          </button>
        )}
      </div>

      {confirming && (
        <div
          role="alertdialog"
          aria-labelledby="delete-warning"
          className="mt-6 rounded-md border border-danger p-5"
        >
          <p id="delete-warning">{ui.account.deleteWarning}</p>
          {reauth && (
            <label className="mt-4 block">
              <span className="text-sm text-ink-muted">{ui.account.reauthPrompt}</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label={ui.auth.codeLabel}
                className="tabular mt-2 block min-h-12 w-40 rounded-md border border-line bg-surface px-4 text-lg tracking-widest"
              />
            </label>
          )}
          {deleteFailed && (
            <p role="alert" className="mt-3 text-sm font-medium text-danger">
              {deleteFailed === 'code' ? ui.account.reauthInvalid : ui.account.deleteFailed}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={deleteAccount}
              disabled={busy !== null || (reauth && code.length !== 6)}
              className="inline-flex min-h-12 items-center justify-center rounded-pill border border-danger px-6 font-semibold text-danger hover:bg-surface disabled:opacity-60"
            >
              {busy === 'delete'
                ? ui.account.deleting
                : reauth
                  ? ui.account.reauthConfirm
                  : ui.account.deleteConfirm}
            </button>
            <button
              type="button"
              onClick={cancelDelete}
              disabled={busy !== null}
              className={secondaryButton}
            >
              {ui.account.deleteCancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
