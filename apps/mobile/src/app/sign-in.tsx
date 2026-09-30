import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, type TextInput, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { authClient } from '@/lib/auth';
import { authErrorMessage, isValidEmail } from '@/lib/auth-errors';
import { currentLocale } from '@/lib/locale';
import { strings } from '@/lib/strings';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_S = 30;

type Step = 'email' | 'code';

/** Modal sign-in with an emailed 6-digit code. Guest data on the device moves to the account afterwards. */
export default function SignInScreen() {
  const s = strings[currentLocale()];
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeInput = useRef<TextInput>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (step === 'code') codeInput.current?.focus();
  }, [step]);

  async function sendCode(resend = false) {
    const address = email.trim().toLowerCase();
    if (!isValidEmail(address)) {
      setError(s.errInvalidEmail);
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const { error: failure } = await authClient.emailOtp.sendVerificationOtp({
        email: address,
        type: 'sign-in',
      });
      if (failure) {
        setError(authErrorMessage(failure, s));
        return;
      }
      setEmail(address);
      setCode('');
      setStep('code');
      setCooldown(RESEND_COOLDOWN_S);
      if (resend) setInfo(s.codeResent);
    } catch (e) {
      setError(authErrorMessage(e, s));
    } finally {
      setBusy(false);
    }
  }

  async function verify(otp: string) {
    if (otp.length !== CODE_LENGTH || busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const { error: failure } = await authClient.signIn.emailOtp({ email, otp });
      if (failure) {
        setError(authErrorMessage(failure, s));
        setCode('');
        return;
      }
      router.back();
    } catch (e) {
      setError(authErrorMessage(e, s));
    } finally {
      setBusy(false);
    }
  }

  function onCodeChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (error) setError(null);
    if (digits.length === CODE_LENGTH) void verify(digits);
  }

  return (
    <Screen form>
      <BackButton label={s.cancel} chevron={false} />

      {step === 'email' ? (
        <>
          <View className="gap-2">
            <Text variant="screen-title" accessibilityRole="header">
              {s.signIn}
            </Text>
            <Text tone="muted">{s.signInPitch}</Text>
          </View>
          <TextField
            label={s.email}
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (error) setError(null);
            }}
            placeholder={s.emailPlaceholder}
            error={error}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            returnKeyType="send"
            editable={!busy}
            onSubmitEditing={() => void sendCode()}
          />
          <Button
            label={s.sendCode}
            disabled={busy || email.trim() === ''}
            onPress={() => void sendCode()}
          />
        </>
      ) : (
        <>
          <View className="gap-2">
            <Text variant="screen-title" accessibilityRole="header">
              {s.codeTitle}
            </Text>
            <Text tone="muted">{s.codeSentTo(email)}</Text>
          </View>
          <TextField
            ref={codeInput}
            label={s.code}
            value={code}
            onChangeText={onCodeChange}
            error={error}
            variant="section-title"
            placeholder="000000"
            maxLength={CODE_LENGTH}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            editable={!busy}
            onSubmitEditing={() => void verify(code)}
          />
          {info ? (
            <Text variant="body-sm" tone="muted" accessibilityLiveRegion="polite">
              {info}
            </Text>
          ) : null}
          <Button
            label={s.signIn}
            disabled={busy || code.length !== CODE_LENGTH}
            onPress={() => void verify(code)}
          />
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy || cooldown > 0 }}
              disabled={busy || cooldown > 0}
              onPress={() => void sendCode(true)}
              className="h-12 justify-center"
            >
              <Text variant="label" tone={cooldown > 0 ? 'muted' : 'primary'}>
                {cooldown > 0 ? s.resendIn(cooldown) : s.resendCode}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                setStep('email');
                setCode('');
                setError(null);
                setInfo(null);
              }}
              className="h-12 justify-center"
            >
              <Text variant="label" tone="primary">
                {s.useAnotherEmail}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </Screen>
  );
}
