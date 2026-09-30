import { recipesById } from '@sipclock/catalog';
import {
  analyzeAvailability,
  estimateAbv,
  partsBase,
  scaleAmount,
  toDisplay,
  type UnitSystem,
} from '@sipclock/engine';
import { formatAmount, glassLabel, methodLabel } from '@sipclock/i18n';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';

import { AbvBadge } from '@/components/abv-badge';
import { BackButton } from '@/components/back-button';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useBar } from '@/hooks/use-bar';
import { useFavorite, useLogDrink } from '@/hooks/use-user-data';
import { currentLocale, ingredientName } from '@/lib/locale';
import { catalogIndex } from '@/lib/makeable';
import { strings } from '@/lib/strings';

const UNITS: UnitSystem[] = ['ml', 'oz', 'parts'];
const MIN_SERVINGS = 1;
const MAX_SERVINGS = 12;

function StepperButton({
  label,
  symbol,
  disabled,
  onPress,
}: {
  label: string;
  symbol: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`size-12 items-center justify-center rounded-pill border border-line bg-surface active:bg-surface-raised ${disabled ? 'opacity-40' : ''}`}
    >
      <Text variant="section-title">{symbol}</Text>
    </Pressable>
  );
}

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const locale = currentLocale();
  const s = strings[locale];
  const bar = useBar();
  const recipe = id ? recipesById.get(id) : undefined;

  const [servings, setServings] = useState(1);
  const [unit, setUnit] = useState<UnitSystem>('ml');
  const favorite = useFavorite(recipe?.id);
  const logDrink = useLogDrink();
  const [logged, setLogged] = useState<'idle' | 'saving' | 'done'>('idle');

  useEffect(() => {
    if (logged !== 'done') return;
    const timer = setTimeout(() => setLogged('idle'), 3000);
    return () => clearTimeout(timer);
  }, [logged]);

  const madeIt = () => {
    if (!recipe || logged === 'saving') return;
    setLogged('saving');
    logDrink(recipe.id)
      .then(() => {
        setLogged('done');
        AccessibilityInfo.announceForAccessibility(s.madeItDone);
      })
      .catch((e) => {
        console.warn('[history] save failed', e);
        setLogged('idle');
      });
  };

  const detail = useMemo(() => {
    if (!recipe || !bar.ids || bar.ids.length === 0) return null;
    return analyzeAvailability(recipe, bar.ids, catalogIndex());
  }, [recipe, bar.ids]);

  if (!recipe) {
    return (
      <Screen>
        <BackButton label={s.back} />
        <Text variant="screen-title" accessibilityRole="header">
          {s.notFoundTitle}
        </Text>
        <Text tone="muted">{s.notFoundHint}</Text>
      </Screen>
    );
  }

  const base = partsBase(recipe);
  const ctx = { partsBase: base === null ? null : base * servings };
  const abv = Math.round(estimateAbv(recipe, catalogIndex()));

  return (
    <Screen>
      <View className="flex-row items-center justify-between gap-3">
        <BackButton label={s.back} />
        <Chip
          label={favorite.saved ? s.saved : s.save}
          selected={favorite.saved}
          accessibilityLabel={favorite.saved ? s.unsaveLabel : s.saveLabel}
          onPress={favorite.toggle}
        />
      </View>

      <View className="gap-3">
        <Text variant="screen-title" accessibilityRole="header">
          {recipe.name[locale]}
        </Text>
        <View className="flex-row items-center justify-between gap-3">
          <Text tone="muted" className="flex-1">
            {glassLabel[locale][recipe.glass]} · {methodLabel[locale][recipe.method]}
          </Text>
          <AbvBadge percent={abv} />
        </View>
        <Text>{recipe.description[locale]}</Text>
      </View>

      <View className="gap-3">
        <Text variant="section-title" accessibilityRole="header">
          {s.servings}
        </Text>
        <View className="flex-row items-center gap-4">
          <StepperButton
            label={s.decreaseServings}
            symbol="−"
            disabled={servings <= MIN_SERVINGS}
            onPress={() => setServings((n) => Math.max(MIN_SERVINGS, n - 1))}
          />
          <Text variant="section-title" accessibilityLiveRegion="polite">
            {servings}
          </Text>
          <StepperButton
            label={s.increaseServings}
            symbol="+"
            disabled={servings >= MAX_SERVINGS}
            onPress={() => setServings((n) => Math.min(MAX_SERVINGS, n + 1))}
          />
        </View>
        <View className="flex-row gap-2">
          {UNITS.map((u) => (
            <Chip key={u} label={s.units[u]} selected={unit === u} onPress={() => setUnit(u)} />
          ))}
        </View>
      </View>

      <View className="gap-2">
        <Text variant="section-title" accessibilityRole="header">
          {s.ingredients}
        </Text>
        {recipe.ingredients.map((item) => {
          const shown = toDisplay(scaleAmount(item.amount, servings), unit, ctx);
          const swap = detail?.swaps.find((x) => x.need === item.ingredient);
          const isMissing = detail?.missing.includes(item.ingredient) ?? false;
          const isHave = detail?.present.includes(item.ingredient) ?? false;
          const status = swap
            ? { text: s.swapWith(ingredientName(swap.use, locale)), tone: 'accent' as const }
            : isMissing
              ? { text: s.missing, tone: 'danger' as const }
              : isHave
                ? { text: s.have, tone: 'muted' as const }
                : null;
          const flag = item.optional ? s.optional : item.garnish ? s.garnish : null;
          return (
            <View
              key={item.ingredient}
              className="min-h-12 flex-row items-center gap-3 border-line border-b py-2"
            >
              <View className="flex-1">
                <Text variant="label">
                  {ingredientName(item.ingredient, locale)}
                  {flag ? <Text variant="body-sm" tone="muted">{` · ${flag}`}</Text> : null}
                </Text>
                {status ? (
                  <Text variant="body-sm" tone={status.tone}>
                    {status.text}
                  </Text>
                ) : null}
              </View>
              <Text variant="label">{formatAmount(shown, locale)}</Text>
            </View>
          );
        })}
      </View>

      <View className="gap-3">
        <Text variant="section-title" accessibilityRole="header">
          {s.steps}
        </Text>
        {recipe.steps.map((step, i) => (
          <View key={step.en} className="flex-row gap-3">
            <Text variant="label" tone="muted" className="w-6">
              {i + 1}
            </Text>
            <Text className="flex-1">{step[locale]}</Text>
          </View>
        ))}
      </View>

      <View className="gap-2">
        <Button label={s.madeIt} loading={logged === 'saving'} onPress={madeIt} />
        <View className="min-h-5 items-center">
          {logged === 'done' ? (
            <Text variant="body-sm" tone="muted">
              {s.madeItDone}
            </Text>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
