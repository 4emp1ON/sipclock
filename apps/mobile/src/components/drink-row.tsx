import { Pressable, View } from 'react-native';

import { Text } from './text';

export interface DrinkRowProps {
  name: string;
  /** Secondary line, e.g. glass and availability, or when it was made. */
  detail?: string | null;
  /** Right-aligned value, e.g. strength. */
  trailing?: string | null;
  onPress?: () => void;
}

/** Compact tappable drink row used in lists (alternatives, favorites, history). */
export function DrinkRow({ name, detail, trailing, onPress }: DrinkRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-14 flex-row items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2 active:bg-surface-raised"
    >
      <View className="flex-1">
        <Text variant="label">{name}</Text>
        {detail ? (
          <Text variant="body-sm" tone="muted" numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing ? (
        <Text variant="label" tone="muted">
          {trailing}
        </Text>
      ) : null}
    </Pressable>
  );
}
