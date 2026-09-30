import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, type TextInput, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { Button } from '@/components/button';
import { PasswordField } from '@/components/password-field';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { authClient } from '@/lib/auth';
import { authErrorMessage, isEmailNotVerified, isValidEmail } from '@/lib/auth-errors';
import { type AuthEvent, type AuthMode, initialMode, isCodeMode, nextMode } from '@/lib/auth-flow';
import { currentLocale } from '@/lib/locale';
import { strings } from '@/lib/strings';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_S = 30;

type Failure = { code?: string | undefined; status?: number | undefined } | null;

/**
 * Modal sign-in. Default: emailed 6-digit code. Alternative: email + password with sign-up and reset by code
 * (mode state machine in `lib/auth-flow`). Guest data on the device moves to the account afterwards.
 * `?mode=reset&email=…` opens the password reset for a known address (Account screen).
 */
export default function SignInScreen() {
  const s = strings[currentLocale()];
  const params = useLocalSearchParams<{ mode?: string; email?: string }>();
  const [start] = useState(() => initialMode(params));
  const [mode, setMode] = useState<AuthMode>(start.mode);
  const [email, setEmail] = useState(start.email);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeInput = useRef<TextInput>(null);
  const autoSent = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (isCodeMode(mode)) codeInput.current?.focus();
  }, [mode]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: sends the reset code once on mount
  useEffect(() => {
    if (start.autoSend && !autoSent.current) {
      autoSent.current = true;
      void requestCode('forgot');
    }
  }, []);

  function go(event: AuthEvent, keep: { info?: string | null } = {}) {
    setMode((m) => nextMode(m, event));
    setError(null);
    setInfo(keep.info ?? null);
    setCode('');
    setPassword('');
  }

  /** Runs a request with the shared busy/error handling; returns whether it succeeded. */
  async function attempt(
    call: () => Promise<{ error: Failure }>,
    onFailure?: (failure: NonNullable<Failure>) => boolean,
  ): Promise<boolean> {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const { error: failure } = await call();
      if (failure) {
        if (!onFailure?.(failure)) setError(authErrorMessage(failure, s));
        return false;
      }
      return true;
    } catch (e) {
      setError(authErrorMessage(e, s));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const address = () => email.trim().toLowerCase();

  function validEmail(): boolean {
    if (isValidEmail(address())) return true;
    setError(s.errInvalidEmail);
    return false;
  }

  /** Sends the code for the current flow: sign-in (email), verification (signup/confirm) or reset (forgot/reset). */
  async function requestCode(from: AuthMode = mode, resend = false) {
    if (!validEmail()) return;
    const to = address();
    const ok = await attempt(() => {
      switch (from) {
        case 'signup':
          return authClient.signUp.email({ email: to, password, name: '' });
        case 'confirm':
          return authClient.emailOtp.sendVerificationOtp({ email: to, type: 'email-verification' });
        case 'forgot':
        case 'reset':
          return authClient.emailOtp.requestPasswordReset({ email: to });
        default:
          return authClient.emailOtp.sendVerificationOtp({ email: to, type: 'sign-in' });
      }
    });
    if (!ok) return;
    setEmail(to);
    setCooldown(RESEND_COOLDOWN_S);
    if (resend) {
      setCode('');
      setInfo(s.codeResent);
    } else {
      setMode((m) => (m === from ? nextMode(m, 'code-sent') : m));
      setCode('');
      setPassword('');
    }
  }

  async function signInWithPassword() {
    if (!validEmail()) return;
    if (password === '') {
      setError(s.errEnterPassword);
      return;
    }
    const to = address();
    const ok = await attempt(
      () => authClient.signIn.email({ email: to, password }),
      (failure) => {
        if (!isEmailNotVerified(failure)) return false;
        // The server just emailed a fresh code.
        setEmail(to);
        setMode((m) => nextMode(m, 'unverified'));
        setCode('');
        setPassword('');
        setInfo(s.confirmEmailFirst);
        setCooldown(RESEND_COOLDOWN_S);
        return true;
      },
    );
    if (ok) router.back();
  }

  async function verifyCode(otp: string) {
    if (otp.length !== CODE_LENGTH || busy) return;
    const ok = await attempt(
      () =>
        mode === 'confirm'
          ? authClient.emailOtp.verifyEmail({ email, otp })
          : authClient.signIn.emailOtp({ email, otp }),
      () => {
        setCode('');
        return false;
      },
    );
    if (ok) router.back();
  }

  async function resetPassword() {
    if (code.length !== CODE_LENGTH || busy) return;
    if (password === '') {
      setError(s.errEnterPassword);
      return;
    }
    const newPassword = password;
    const ok = await attempt(() =>
      authClient.emailOtp.resetPassword({ email, otp: code, password: newPassword }),
    );
    if (!ok) return;
    // Every session was revoked: sign back in with the new password.
    const signedIn = await attempt(() => authClient.signIn.email({ email, password: newPassword }));
    if (signedIn) {
      router.back();
    } else {
      setMode('password');
      setPassword('');
      setCode('');
      setError(null);
      setInfo(s.passwordUpdated);
    }
  }

  function onCodeChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (error) setError(null);
    if (digits.length === CODE_LENGTH && mode !== 'reset') void verifyCode(digits);
  }

  function onEmailChange(text: string) {
    setEmail(text);
    if (error) setError(null);
  }

  const link = (label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      className="h-12 justify-center"
    >
      <Text variant="label" tone="primary">
        {label}
      </Text>
    </Pressable>
  );

  const emailField = (returnKeyType: 'send' | 'next' | 'go', onSubmit: () => void) => (
    <TextField
      label={s.email}
      value={email}
      onChangeText={onEmailChange}
      placeholder={s.emailPlaceholder}
      error={mode === 'password' || mode === 'signup' ? null : error}
      autoFocus={!start.autoSend}
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="email"
      textContentType={mode === 'password' || mode === 'signup' ? 'username' : 'emailAddress'}
      keyboardType="email-address"
      returnKeyType={returnKeyType}
      editable={!busy}
      onSubmitEditing={onSubmit}
    />
  );

  const infoLine = info ? (
    <Text variant="body-sm" tone="muted" accessibilityLiveRegion="polite">
      {info}
    </Text>
  ) : null;

  const titles: Record<AuthMode, [string, string | null]> = {
    email: [s.signIn, s.signInPitch],
    code: [s.codeTitle, s.codeSentTo(email)],
    password: [s.signIn, s.signInPitch],
    signup: [s.createAccount, s.createAccountPitch],
    confirm: [s.confirmEmailTitle, s.codeSentTo(email)],
    forgot: [s.forgotTitle, s.forgotPitch],
    reset: [s.resetTitle, s.codeSentTo(email)],
  };
  const [title, pitch] = titles[mode];

  return (
    <Screen form>
      <BackButton label={s.cancel} chevron={false} />
      <View className="gap-2">
        <Text variant="screen-title" accessibilityRole="header">
          {title}
        </Text>
        {pitch ? <Text tone="muted">{pitch}</Text> : null}
      </View>

      {mode === 'email' ? (
        <>
          {emailField('send', () => void requestCode())}
          <Button
            label={s.sendCode}
            disabled={busy || email.trim() === ''}
            onPress={() => void requestCode()}
          />
          <Button
            label={s.usePassword}
            variant="secondary"
            disabled={busy}
            onPress={() => go('use-password')}
          />
        </>
      ) : null}

      {mode === 'password' ? (
        <>
          {emailField('next', () => {})}
          <PasswordField
            label={s.password}
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              if (error) setError(null);
            }}
            error={error}
            returnKeyType="go"
            editable={!busy}
            onSubmitEditing={() => void signInWithPassword()}
          />
          {infoLine}
          <Button
            label={s.signIn}
            loading={busy}
            disabled={email.trim() === '' || password === ''}
            onPress={() => void signInWithPassword()}
          />
          <View className="flex-row flex-wrap items-center justify-between gap-x-4">
            {link(s.forgotPassword, () => go('forgot'))}
            {link(s.createAccount, () => go('create-account'))}
          </View>
          {link(s.useCodeInstead, () => go('use-code'))}
        </>
      ) : null}

      {mode === 'signup' ? (
        <>
          {emailField('next', () => {})}
          <PasswordField
            label={s.newPassword}
            hint={s.passwordHint}
            isNew
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              if (error) setError(null);
            }}
            error={error}
            returnKeyType="go"
            editable={!busy}
            onSubmitEditing={() => void requestCode()}
          />
          <Button
            label={s.createAccount}
            loading={busy}
            disabled={email.trim() === '' || password === ''}
            onPress={() => void requestCode()}
          />
          <View className="flex-row flex-wrap items-center justify-between gap-x-4">
            {link(s.haveAccount, () => go('back'))}
            {link(s.useCodeInstead, () => go('use-code'))}
          </View>
        </>
      ) : null}

      {mode === 'forgot' ? (
        <>
          {emailField('send', () => void requestCode())}
          <Button
            label={s.sendCode}
            loading={busy}
            disabled={email.trim() === ''}
            onPress={() => void requestCode()}
          />
          <View className="flex-row flex-wrap items-center justify-between gap-x-4">
            {link(s.haveAccount, () => go('back'))}
            {link(s.useCodeInstead, () => go('use-code'))}
          </View>
        </>
      ) : null}

      {isCodeMode(mode) ? (
        <>
          <TextField
            ref={codeInput}
            label={s.code}
            value={code}
            onChangeText={onCodeChange}
            error={mode === 'reset' ? null : error}
            variant="section-title"
            placeholder="000000"
            maxLength={CODE_LENGTH}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            editable={!busy}
            onSubmitEditing={() => void (mode === 'reset' ? resetPassword() : verifyCode(code))}
          />
          {mode === 'reset' ? (
            <PasswordField
              label={s.newPassword}
              hint={s.passwordHint}
              isNew
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (error) setError(null);
              }}
              error={error}
              returnKeyType="go"
              editable={!busy}
              onSubmitEditing={() => void resetPassword()}
            />
          ) : null}
          {infoLine}
          <Button
            label={mode === 'reset' ? s.setPassword : mode === 'confirm' ? s.confirm : s.signIn}
            loading={busy}
            disabled={code.length !== CODE_LENGTH || (mode === 'reset' && password === '')}
            onPress={() => void (mode === 'reset' ? resetPassword() : verifyCode(code))}
          />
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy || cooldown > 0 }}
              disabled={busy || cooldown > 0}
              onPress={() => void requestCode(mode, true)}
              className="h-12 justify-center"
            >
              <Text variant="label" tone={cooldown > 0 ? 'muted' : 'primary'}>
                {cooldown > 0 ? s.resendIn(cooldown) : s.resendCode}
              </Text>
            </Pressable>
            {link(s.useAnotherEmail, () => go('change-email'))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
