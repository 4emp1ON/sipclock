import { forwardRef, type ReactNode } from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { type TextVariant, textStyle } from '@/lib/typography';
import { Text } from './text';

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'className'> {
  label: string;
  /** Shown under the field in the danger tone and announced to screen readers. */
  error?: string | null;
  variant?: TextVariant;
  /** Rendered inside the field's right edge, e.g. a show/hide toggle. */
  trailing?: ReactNode;
  /** Hint under the field when there is no error. */
  hint?: string;
}

/** Labeled single-line input, 48px tall, with an optional error line. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, variant = 'body', trailing, hint, ...rest },
  ref,
) {
  const { colors } = useTheme();
  return (
    <View className="gap-2">
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <View className="justify-center">
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors['ink-muted']}
          className={`h-12 rounded-lg border bg-surface text-ink ${trailing ? 'pr-14 pl-4' : 'px-4'} ${error ? 'border-danger' : 'border-line'}`}
          style={textStyle(variant)}
          {...rest}
        />
        {trailing ? <View className="absolute right-0 h-12 justify-center">{trailing}</View> : null}
      </View>
      {error ? (
        <Text
          variant="body-sm"
          tone="danger"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : hint ? (
        <Text variant="body-sm" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
