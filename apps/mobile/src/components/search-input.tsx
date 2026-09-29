import { TextInput } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { textStyle } from '@/lib/typography';

export interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}

export function SearchInput({ value, onChangeText, placeholder }: SearchInputProps) {
  const { colors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors['ink-muted']}
      accessibilityLabel={placeholder}
      autoCorrect={false}
      autoCapitalize="none"
      clearButtonMode="while-editing"
      returnKeyType="search"
      className="h-12 rounded-pill border border-line bg-surface px-5 text-ink"
      style={textStyle('body')}
    />
  );
}
