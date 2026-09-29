import { View } from 'react-native';

import { Text } from './text';

export function AbvBadge({ percent }: { percent: number }) {
  return (
    <View
      accessible
      accessibilityLabel={`${percent} percent alcohol`}
      className="flex-row items-baseline gap-1 rounded-pill bg-accent px-3 py-2"
    >
      <Text variant="abv" tone="onAccent">
        {percent}%
      </Text>
      <Text variant="caption" tone="onAccent">
        Alc.
      </Text>
    </View>
  );
}
