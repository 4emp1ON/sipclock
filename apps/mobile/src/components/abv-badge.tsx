import { View } from 'react-native';

import { currentLocale } from '@/lib/locale';
import { strings } from '@/lib/strings';
import { Text } from './text';

export function AbvBadge({ percent }: { percent: number }) {
  const s = strings[currentLocale()];
  return (
    <View
      accessible
      accessibilityLabel={s.abvLabel(percent)}
      className="flex-row items-baseline gap-1 rounded-pill bg-accent px-3 py-2"
    >
      <Text variant="abv" tone="onAccent">
        {percent}%
      </Text>
      <Text variant="caption" tone="onAccent">
        {s.alcAbbr}
      </Text>
    </View>
  );
}
