import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { Text } from './text';

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** Text back link for stack screens; `chevron={false}` for modal dismiss labels such as Cancel. */
export function BackButton({ label, chevron = true }: { label: string; chevron?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={goBack}
      className="h-12 self-start justify-center pr-4"
    >
      <Text variant="label" tone="primary">
        {chevron ? `‹ ${label}` : label}
      </Text>
    </Pressable>
  );
}
