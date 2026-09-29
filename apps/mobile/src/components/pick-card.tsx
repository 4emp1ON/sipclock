import { View } from 'react-native';

import { AbvBadge } from './abv-badge';
import { Text } from './text';

export interface PickCardProps {
  name: string;
  style: string;
  mood: string;
  abv: number;
  /** Availability pill text; omitted when the bar is unknown. */
  availability?: string | null;
}

/** Simple highball glass drawn with views until real drink photos exist. */
function GlassPlaceholder() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="h-44 w-24 overflow-hidden rounded-b-md border-2 border-ink-muted border-t-0"
    >
      <View className="absolute inset-x-0 bottom-0 h-32 bg-mint opacity-60" />
      <View className="absolute top-14 left-2 size-7 rotate-12 rounded-sm bg-on-photo opacity-40" />
      <View className="absolute top-24 right-2 size-7 -rotate-6 rounded-sm bg-on-photo opacity-40" />
    </View>
  );
}

export function PickCard({ name, style, mood, abv, availability }: PickCardProps) {
  return (
    <View className="h-[420px] overflow-hidden rounded-lg bg-surface-raised shadow-card">
      <View className="flex-1 items-center justify-center pb-24">
        <GlassPlaceholder />
      </View>
      {availability ? (
        <View className="absolute top-4 left-4 rounded-pill bg-mint px-3 py-2">
          <Text variant="label" tone="onMint">
            {availability}
          </Text>
        </View>
      ) : null}
      <View className="absolute inset-x-0 bottom-0 flex-row items-end gap-3 bg-photo-scrim p-5">
        <View className="flex-1 gap-1">
          <Text variant="drink-title" tone="onPhoto">
            {name}
          </Text>
          <Text variant="body-sm" tone="onPhotoMuted">
            {style} · {mood}
          </Text>
        </View>
        <AbvBadge percent={abv} />
      </View>
    </View>
  );
}
