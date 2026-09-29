import { Pressable } from 'react-native';

import { Text } from './text';

export interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary';
  onPress?: () => void;
  className?: string;
}

/** Pill button, 48px tall touch target. */
export function Button({ label, variant = 'primary', onPress, className }: ButtonProps) {
  const base = 'h-12 items-center justify-center rounded-pill px-6';
  const look =
    variant === 'primary'
      ? 'bg-primary active:bg-primary-pressed'
      : 'border border-line bg-transparent active:bg-surface';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`${base} ${look} ${className ?? ''}`}
    >
      <Text variant="label" tone={variant === 'primary' ? 'onPrimary' : 'ink'}>
        {label}
      </Text>
    </Pressable>
  );
}
