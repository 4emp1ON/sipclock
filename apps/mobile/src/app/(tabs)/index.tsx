import { catalog, recipesById } from '@sipclock/catalog';
import type { Occasion } from '@sipclock/domain';
import { recommend } from '@sipclock/engine';
import { glassLabel, methodLabel, occasionLabel, reasonLine } from '@sipclock/i18n';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { PickCard } from '@/components/pick-card';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { loadRecent, pushRecent, saveRecent } from '@/data/kv';
import { useBar } from '@/hooks/use-bar';
import { useNow } from '@/hooks/use-now';
import { availabilityLabel } from '@/lib/availability-label';
import { currentLocale, deviceLocaleTag, ingredientName } from '@/lib/locale';
import { buildRecommendInput } from '@/lib/recommend-input';
import { strings } from '@/lib/strings';
import { formatDayLabel, formatTime } from '@/lib/time';

const OCCASIONS: Occasion[] = ['after-work', 'date', 'party', 'chill', 'brunch'];

type Filter = Occasion | 'no-alcohol' | null;

export default function TodayScreen() {
  const now = useNow();
  const db = useSQLiteContext();
  const bar = useBar();
  const locale = currentLocale();
  const tag = deviceLocaleTag();
  const s = strings[locale];

  const [filter, setFilter] = useState<Filter>(null);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    loadRecent(db)
      .then(setRecent)
      .catch(() => undefined);
  }, [db]);

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
    const next = pick ? pushRecent(recent, pick.recipeId) : recent;
    setRecent(next);
    setSeed(Math.floor(Math.random() * 0x7fffffff));
    saveRecent(db, next).catch(() => undefined);
  }, [db, pick, recent]);

  const toggle = (next: Filter) => setFilter((cur) => (cur === next ? null : next));

  return (
    <Screen>
      <View className="gap-1">
        <Text variant="body-sm" tone="muted">
          <Text variant="body-sm">{s.now}</Text> · {formatDayLabel(now, tag)}
        </Text>
        <Text variant="time-hero" accessibilityLabel={s.timeLabel(formatTime(now, tag))}>
          {formatTime(now, tag)}
        </Text>
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
                  <Pressable
                    key={alt.recipeId}
                    accessibilityRole="button"
                    onPress={() => openRecipe(alt.recipeId)}
                    className="min-h-14 flex-row items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2 active:bg-surface-raised"
                  >
                    <View className="flex-1">
                      <Text variant="label">{recipe.name[locale]}</Text>
                      <Text variant="body-sm" tone="muted" numberOfLines={1}>
                        {glassLabel[locale][recipe.glass]}
                        {pill ? ` · ${pill}` : ''}
                      </Text>
                    </View>
                    <Text variant="label" tone="muted">
                      {alt.abv}%
                    </Text>
                  </Pressable>
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
