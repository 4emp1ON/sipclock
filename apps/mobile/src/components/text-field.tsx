import { forwardRef } from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { type TextVariant, textStyle } from '@/lib/typography';
import { Text } from './text';

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'className'> {
  label: string;
  /** Shown under the field in the danger tone and announced to screen readers. */
  error?: string | null;
  variant?: TextVariant;
}

/** Labeled single-line input, 48px tall, with an optional error line. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, variant = 'body', ...rest },
  ref,
) {
  const { colors } = useTheme();
  return (
    <View className="gap-2">
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors['ink-muted']}
        className={`h-12 rounded-lg border bg-surface px-4 text-ink ${error ? 'border-danger' : 'border-line'}`}
        style={textStyle(variant)}
        {...rest}
      />
      {error ? (
        <Text
          variant="body-sm"
          tone="danger"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
});
