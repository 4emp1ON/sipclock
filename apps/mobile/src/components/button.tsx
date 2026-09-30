import { ActivityIndicator, Pressable } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Text } from './text';

export interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onPress?: () => void;
  disabled?: boolean;
  /** Shows a spinner in place of the label and blocks presses. */
  loading?: boolean;
  className?: string;
}

const LOOK = {
  primary: 'bg-primary active:bg-primary-pressed',
  secondary: 'border border-line bg-transparent active:bg-surface',
  danger: 'border border-danger bg-transparent active:bg-surface',
} as const;

const TONE = { primary: 'onPrimary', secondary: 'ink', danger: 'danger' } as const;

/** Pill button, 48px tall touch target. */
export function Button({
  label,
  variant = 'primary',
  onPress,
  disabled = false,
  loading = false,
  className,
}: ButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      className={`h-12 items-center justify-center rounded-pill px-6 ${LOOK[variant]} ${disabled ? 'opacity-40' : ''} ${className ?? ''}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors['on-primary'] : colors.ink} />
      ) : (
        <Text variant="label" tone={TONE[variant]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
