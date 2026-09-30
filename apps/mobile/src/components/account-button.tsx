import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { useAccount } from '@/hooks/use-account';
import { currentLocale } from '@/lib/locale';
import { strings } from '@/lib/strings';
import { Text } from './text';

/** Header shortcut to the account screen: the email's initial when signed in, "Sign in" for guests. */
export function AccountButton() {
  const s = strings[currentLocale()];
  const { user } = useAccount();
  const initial = user?.email.trim().charAt(0).toUpperCase();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={s.account}
      hitSlop={4}
      onPress={() => router.push('/account')}
      className={
        initial
          ? 'size-10 items-center justify-center rounded-pill bg-surface-raised active:bg-surface'
          : 'h-10 items-center justify-center rounded-pill border border-line px-4 active:bg-surface'
      }
    >
      <Text variant="label" tone={initial ? 'primary' : 'ink'}>
        {initial ?? s.signIn}
      </Text>
    </Pressable>
  );
}
