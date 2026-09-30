import { Pressable } from 'react-native';

import { Text } from './text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function Chip({ label, selected = false, onPress, accessibilityLabel }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      hitSlop={{ top: 4, bottom: 4 }}
      onPress={onPress}
      className={
        selected
          ? 'h-10 items-center justify-center rounded-pill bg-primary px-4'
          : 'h-10 items-center justify-center rounded-pill border border-line bg-surface px-4'
      }
    >
      <Text variant="label" tone={selected ? 'onPrimary' : 'ink'}>
        {label}
      </Text>
    </Pressable>
  );
}
