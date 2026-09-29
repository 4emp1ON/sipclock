import { View } from 'react-native';

import { currentLocale } from '@/lib/locale';
import { strings } from '@/lib/strings';
import { Text } from './text';

/** Strength of the finished drink. Alcohol-free drinks use the mint variant with a word, never color alone. */
export function AbvBadge({ percent }: { percent: number }) {
  const s = strings[currentLocale()];
  const free = percent === 0;
  const tone = free ? 'onMint' : 'onAccent';
  return (
    <View
      accessible
      accessibilityLabel={free ? s.alcoholFreeLabel : s.abvLabel(percent)}
      className={`flex-row items-baseline gap-1 rounded-pill px-3 py-2 ${free ? 'bg-mint' : 'bg-accent'}`}
    >
      <Text variant="abv" tone={tone}>
        {percent}%
      </Text>
      <Text variant="caption" tone={tone}>
        {free ? s.freeAbbr : s.alcAbbr}
      </Text>
    </View>
  );
}
