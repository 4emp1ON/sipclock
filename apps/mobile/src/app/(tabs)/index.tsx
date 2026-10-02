import { usePowerSync } from '@powersync/react-native';
import { catalog, recipesById } from '@sipclock/catalog';
import type { Occasion } from '@sipclock/domain';
import { recommend } from '@sipclock/engine';
import { glassLabel, methodLabel, occasionLabel, reasonLine } from '@sipclock/i18n';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AccountButton } from '@/components/account-button';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { DrinkRow } from '@/components/drink-row';
import { PickCard } from '@/components/pick-card';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { mergeRecent, pushRecent, pushRecentPick } from '@/data/kv';
import { useBar } from '@/hooks/use-bar';
import { useNow } from '@/hooks/use-now';
import { useStoredRecent } from '@/hooks/use-user-data';
import { availabilityLabel } from '@/lib/availability-label';
import { currentLocale, deviceLocaleTag, ingredientName } from '@/lib/locale';
import { buildRecommendInput } from '@/lib/recommend-input';
import { strings } from '@/lib/strings';
import { formatDayLabel, formatTime } from '@/lib/time';

const OCCASIONS: Occasion[] = ['after-work', 'date', 'party', 'chill', 'brunch'];

type Filter = Occasion | 'no-alcohol' | null;

export default function TodayScreen() {
  const now = useNow();
  const db = usePowerSync();
  const bar = useBar();
  const locale = currentLocale();
  const tag = deviceLocaleTag();
  const s = strings[locale];

  const [filter, setFilter] = useState<Filter>(null);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  // Picks skipped in this session go first, so the next idea changes at once; the stored list (also fed by
  // "I made it" on the recipe screen) catches up after the write.
  const [sessionRecent, setSessionRecent] = useState<string[]>([]);
  const stored = useStoredRecent();
  const recentKey = mergeRecent(sessionRecent, stored.recent).join(',');
  const recent = useMemo(() => (recentKey ? recentKey.split(',') : []), [recentKey]);

  const occasion = filter && filter !== 'no-alcohol' ? filter : null;
  const alcoholFree = filter === 'no-alcohol';
  const barIds = bar.ids;

  const result = useMemo(
    () =>
      recommend(
        buildRecommendInput({ now, occasion, alcoholFree, bar: barIds, recent, seed }),
        catalog,
      ),
    [now, occasion, alcoholFree, barIds, recent, seed],
  );

  const pick = result.pick;
  const pickRecipe = pick ? recipesById.get(pick.recipeId) : undefined;

  const openRecipe = useCallback((id: string) => router.push(`/recipe/${id}`), []);

  const anotherIdea = useCallback(() => {
    if (pick) {
      setSessionRecent((cur) => pushRecent(cur, pick.recipeId));
      pushRecentPick(db, pick.recipeId).catch((e) => console.warn('[recent] save failed', e));
    }
    setSeed(Math.floor(Math.random() * 0x7fffffff));
  }, [pick, db]);

  const toggle = (next: Filter) => setFilter((cur) => (cur === next ? null : next));

  return (
    <Screen>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text variant="body-sm" tone="muted">
            <Text variant="body-sm">{s.now}</Text> · {formatDayLabel(now, tag)}
          </Text>
          <Text variant="time-hero" accessibilityLabel={s.timeLabel(formatTime(now, tag))}>
            {formatTime(now, tag)}
          </Text>
        </View>
        <AccountButton />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-5 grow-0"
        contentContainerClassName="gap-2 px-5"
      >
        {OCCASIONS.map((o) => (
          <Chip
            key={o}
            label={occasionLabel[locale][o]}
            selected={filter === o}
            onPress={() => toggle(o)}
          />
        ))}
        <Chip label={s.noAlcohol} selected={alcoholFree} onPress={() => toggle('no-alcohol')} />
      </ScrollView>

      {pick && pickRecipe ? (
        <>
          <PickCard
            name={pickRecipe.name[locale]}
            style={glassLabel[locale][pickRecipe.glass]}
            mood={methodLabel[locale][pickRecipe.method]}
            abv={pick.abv}
            availability={availabilityLabel(pick.availability, locale)}
          />

          <Text variant="body" tone="muted">
            {reasonLine(pick.reasons, locale, ingredientName, 2)}
          </Text>

          <View className="flex-row gap-3">
            <Button label={s.makeIt} className="flex-1" onPress={() => openRecipe(pick.recipeId)} />
            <Button
              label={s.anotherIdea}
              variant="secondary"
              className="flex-1"
              onPress={anotherIdea}
            />
          </View>

          {result.alternatives.length > 0 ? (
            <View className="gap-2">
              <Text variant="label" tone="muted" accessibilityRole="header">
                {s.alsoGoodNow}
              </Text>
              {result.alternatives.map((alt) => {
                const recipe = recipesById.get(alt.recipeId);
                if (!recipe) return null;
                const pill = availabilityLabel(alt.availability, locale);
                return (
                  <DrinkRow
                    key={alt.recipeId}
                    name={recipe.name[locale]}
                    detail={`${glassLabel[locale][recipe.glass]}${pill ? ` · ${pill}` : ''}`}
                    abv={alt.abv}
                    onPress={() => openRecipe(alt.recipeId)}
                  />
                );
              })}
            </View>
          ) : null}
        </>
      ) : (
        <View className="gap-2 rounded-lg border border-line bg-surface p-5">
          <Text variant="drink-title">{s.emptyTitle}</Text>
          <Text tone="muted">{s.emptyHint}</Text>
        </View>
      )}
    </Screen>
  );
}
