import { ScrollView, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { PickCard } from '@/components/pick-card';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useNow } from '@/hooks/use-now';
import { formatDayLabel, formatTime } from '@/lib/time';

const OCCASIONS = ['After work', 'Date', 'Party', 'Chill', 'No alcohol'];
const SELECTED_OCCASION = 'After work';
const WEATHER = '+27° clear'; // static until the weather source is wired up

export default function TodayScreen() {
  const now = useNow();

  return (
    <Screen>
      <View className="gap-1">
        <Text variant="body-sm" tone="muted">
          <Text variant="body-sm">Now</Text> · {formatDayLabel(now, 'en-US')} · {WEATHER}
        </Text>
        <Text variant="time-hero" accessibilityLabel={`Current time ${formatTime(now)}`}>
          {formatTime(now)}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-5 grow-0"
        contentContainerClassName="gap-2 px-5"
      >
        {OCCASIONS.map((label) => (
          <Chip key={label} label={label} selected={label === SELECTED_OCCASION} />
        ))}
      </ScrollView>

      <PickCard
        name="Gin & Tonic"
        style="Highball"
        mood="Fresh"
        abv={9}
        availability="Ready · 1 swap"
      />

      <Text variant="body" tone="muted">
        Light and dry, right for a warm evening after work.
      </Text>

      <View className="flex-row gap-3">
        <Button label="Make it" className="flex-1" />
        <Button label="Another idea" variant="secondary" className="flex-1" />
      </View>
    </Screen>
  );
}
