import { forwardRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { Pressable } from 'react-native';
import { currentLocale } from '@/lib/locale';
import { strings } from '@/lib/strings';
import { Text } from './text';
import { TextField, type TextFieldProps } from './text-field';

export interface PasswordFieldProps extends Omit<TextFieldProps, 'secureTextEntry' | 'trailing'> {
  /** Sets autofill hints for a new password (sign-up, reset) instead of an existing one. */
  isNew?: boolean;
}

/** Password input with a show/hide toggle and the autofill hints password managers need. */
export const PasswordField = forwardRef<TextInput, PasswordFieldProps>(function PasswordField(
  { isNew = false, ...rest },
  ref,
) {
  const s = strings[currentLocale()];
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      ref={ref}
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete={isNew ? 'password-new' : 'password'}
      textContentType={isNew ? 'newPassword' : 'password'}
      {...rest}
      secureTextEntry={!visible}
      trailing={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? s.hidePassword : s.showPassword}
          hitSlop={4}
          onPress={() => setVisible((v) => !v)}
          className="h-12 justify-center px-4"
        >
          <Text variant="label" tone="primary">
            {visible ? s.hide : s.show}
          </Text>
        </Pressable>
      }
    />
  );
});
