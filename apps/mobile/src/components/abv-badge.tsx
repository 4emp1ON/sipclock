import { View } from 'react-native';

import { currentLocale } from '@/lib/locale';
import { strings } from '@/lib/strings';
import { Text } from './text';

/** Strength of the finished drink: the number on accent, or the word on mint (never a bare 0%). Never shrinks or wraps. */
export function AbvBadge({ percent }: { percent: number }) {
  const s = strings[currentLocale()];
  const free = percent === 0;
  return (
    <View
      accessible
      accessibilityLabel={free ? s.alcoholFreeLabel : s.abvLabel(percent)}
      style={{ flexShrink: 0 }}
      className={`min-h-8 justify-center rounded-sm px-3 py-1 ${free ? 'bg-mint' : 'bg-accent'}`}
    >
      {free ? (
        <Text variant="label" tone="onMint" numberOfLines={1}>
          {s.alcoholFreeLabel}
        </Text>
      ) : (
        <Text
          variant="abv"
          tone="onAccent"
          numberOfLines={1}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {percent}%
        </Text>
      )}
    </View>
  );
}
