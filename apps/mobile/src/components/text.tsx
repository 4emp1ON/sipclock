import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { type TextVariant, textStyle } from '@/lib/typography';

// Full class names so Tailwind can see them.
const TONES = {
  ink: 'text-ink',
  muted: 'text-ink-muted',
  primary: 'text-primary',
  accent: 'text-accent',
  danger: 'text-danger',
  onPrimary: 'text-on-primary',
  onAccent: 'text-on-accent',
  onMint: 'text-on-mint',
  onPhoto: 'text-on-photo',
  onPhotoMuted: 'text-on-photo-muted',
} as const;

export type TextTone = keyof typeof TONES;

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
}

/** Design-system text: font, size and line height come from a token text style, color from a tone. */
export function Text({ variant = 'body', tone = 'ink', className, style, ...rest }: TextProps) {
  return (
    <RNText
      className={className ? `${TONES[tone]} ${className}` : TONES[tone]}
      style={[textStyle(variant), style]}
      {...rest}
    />
  );
}
