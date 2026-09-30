import { recipesById } from '@sipclock/catalog';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { Button } from '@/components/button';
import { DrinkRow } from '@/components/drink-row';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import {
  AccountError,
  deleteAccount,
  deleteAccountWithCode,
  needsFreshSession,
  pendingUploads,
  sendSignInCode,
  signOut,
  useAccount,
  useSyncStatus,
} from '@/hooks/use-account';
import { useHistory } from '@/hooks/use-user-data';
import { authErrorMessage } from '@/lib/auth-errors';
import { currentLocale, deviceLocaleTag } from '@/lib/locale';
import { strings } from '@/lib/strings';
import { formatDayTime, formatTime } from '@/lib/time';

const CODE_LENGTH = 6;

function SyncLine() {
  const s = strings[currentLocale()];
  const { state, lastSyncedAt } = useSyncStatus();
  const text =
    state === 'synced' && lastSyncedAt
      ? s.syncedAt(formatTime(lastSyncedAt, deviceLocaleTag()))
      : s.sync[state];
  return (
    <Text
      variant="body-sm"
      tone={state === 'error' ? 'danger' : 'muted'}
      accessibilityLiveRegion="polite"
    >
      {text}
    </Text>
  );
}

function History() {
  const locale = currentLocale();
  const tag = deviceLocaleTag();
  const s = strings[locale];
  const history = useHistory();
  return (
    <View className="gap-2">
      <Text variant="section-title" accessibilityRole="header">
        {s.history}
      </Text>
      {history?.length === 0 ? <Text tone="muted">{s.historyEmpty}</Text> : null}
      {history?.map((entry) => {
        const recipe = recipesById.get(entry.recipeId);
        return (
          <DrinkRow
            key={entry.id}
            name={recipe?.name[locale] ?? entry.recipeId}
            detail={formatDayTime(new Date(entry.madeAt), tag)}
            onPress={recipe ? () => router.push(`/recipe/${entry.recipeId}`) : undefined}
          />
        );
      })}
    </View>
  );
}

export default function AccountScreen() {
  const s = strings[currentLocale()];
  const { user } = useAccount();
  const [busy, setBusy] = useState<'sign-out' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set when deletion needs a fresh session: the user confirms with an emailed code.
  const [deleteCode, setDeleteCode] = useState<string | null>(null);

  async function run(
    kind: 'sign-out' | 'delete',
    action: () => Promise<void>,
    describe: (e: unknown) => string = (e) => authErrorMessage(e, s),
  ) {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(null);
    }
  }

  const startDelete = () =>
    run('delete', async () => {
      try {
        await deleteAccount();
      } catch (e) {
        if (!needsFreshSession(e) || !user) throw e;
        await sendSignInCode(user.email);
        setDeleteCode('');
      }
    });

  const submitDeleteCode = (code: string) => {
    if (!user || code.length !== CODE_LENGTH || busy) return;
    const wrongCode = (e: unknown) => e instanceof AccountError && e.code === 'INVALID_OTP';
    void run(
      'delete',
      async () => {
        try {
          await deleteAccountWithCode(user.email, code);
          setDeleteCode(null);
        } catch (e) {
          if (wrongCode(e)) setDeleteCode('');
          throw e;
        }
      },
      (e) => (wrongCode(e) ? s.errCodeDidNotWork : authErrorMessage(e, s)),
    );
  };

  async function confirmSignOut() {
    const pending = await pendingUploads().catch(() => 0);
    Alert.alert(
      s.signOutTitle,
      pending > 0 ? `${s.signOutBody} ${s.signOutUnsynced}` : s.signOutBody,
      [
        { text: s.cancel, style: 'cancel' },
        { text: s.signOut, style: 'destructive', onPress: () => void run('sign-out', signOut) },
      ],
    );
  }

  function confirmDelete() {
    Alert.alert(s.deleteTitle, s.deleteBody, [
      { text: s.cancel, style: 'cancel' },
      { text: s.deleteYes, style: 'destructive', onPress: () => void startDelete() },
    ]);
  }

  return (
    <Screen form>
      <BackButton label={s.back} />
      <Text variant="screen-title" accessibilityRole="header">
        {s.account}
      </Text>

      {user ? (
        <View className="gap-1">
          <Text variant="body-sm" tone="muted">
            {s.signedInAs}
          </Text>
          <Text variant="label">{user.email}</Text>
          <SyncLine />
        </View>
      ) : (
        <View className="gap-3 rounded-lg border border-line bg-surface p-5">
          <Text variant="drink-title">{s.signInPitch}</Text>
          <Text tone="muted">{s.guestNote}</Text>
          <Button label={s.signIn} onPress={() => router.push('/sign-in')} />
        </View>
      )}

      <History />

      {user ? (
        <View className="gap-3">
          {error && deleteCode === null ? (
            <Text variant="body-sm" tone="danger" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Button
            label={s.setOrChangePassword}
            variant="secondary"
            disabled={busy !== null}
            onPress={() =>
              router.push({ pathname: '/sign-in', params: { mode: 'reset', email: user.email } })
            }
          />
          <Button
            label={s.signOut}
            variant="secondary"
            loading={busy === 'sign-out'}
            disabled={busy === 'delete'}
            onPress={() => void confirmSignOut()}
          />
          {deleteCode === null ? (
            <Button
              label={s.deleteAccount}
              variant="danger"
              loading={busy === 'delete'}
              disabled={busy === 'sign-out'}
              onPress={confirmDelete}
            />
          ) : (
            <View className="gap-3 rounded-lg border border-danger bg-surface p-4">
              <Text>{s.deleteCodePrompt}</Text>
              <TextField
                label={s.code}
                value={deleteCode}
                onChangeText={(text) => {
                  const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
                  setDeleteCode(digits);
                  setError(null);
                  if (digits.length === CODE_LENGTH) submitDeleteCode(digits);
                }}
                error={error}
                variant="section-title"
                placeholder="000000"
                maxLength={CODE_LENGTH}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                autoFocus
                editable={busy === null}
              />
              <View className="flex-row gap-3">
                <Button
                  label={s.cancel}
                  variant="secondary"
                  className="flex-1"
                  disabled={busy !== null}
                  onPress={() => {
                    setDeleteCode(null);
                    setError(null);
                  }}
                />
                <Button
                  label={s.deleteYes}
                  variant="danger"
                  className="flex-1"
                  loading={busy === 'delete'}
                  disabled={deleteCode.length !== CODE_LENGTH}
                  onPress={() => submitDeleteCode(deleteCode)}
                />
              </View>
            </View>
          )}
        </View>
      ) : null}
    </Screen>
  );
}
