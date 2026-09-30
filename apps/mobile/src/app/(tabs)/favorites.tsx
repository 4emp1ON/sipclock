import { recipesById } from '@sipclock/catalog';
import { estimateAbv } from '@sipclock/engine';
import { glassLabel, methodLabel } from '@sipclock/i18n';
import { router } from 'expo-router';
import { View } from 'react-native';

import { AccountButton } from '@/components/account-button';
import { Button } from '@/components/button';
import { DrinkRow } from '@/components/drink-row';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useFavorites } from '@/hooks/use-user-data';
import { currentLocale } from '@/lib/locale';
import { catalogIndex } from '@/lib/makeable';
import { strings } from '@/lib/strings';

export default function FavoritesScreen() {
  const locale = currentLocale();
  const s = strings[locale];
  const ids = useFavorites();
  const recipes = (ids ?? []).flatMap((id) => {
    const recipe = recipesById.get(id);
    return recipe ? [recipe] : [];
  });

  return (
    <Screen>
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="screen-title" accessibilityRole="header" className="flex-1">
          {s.favoritesTitle}
        </Text>
        <AccountButton />
      </View>

      {ids !== null && recipes.length === 0 ? (
        <View className="gap-3 rounded-lg border border-line bg-surface p-5">
          <Text variant="drink-title">{s.favoritesEmptyTitle}</Text>
          <Text tone="muted">{s.favoritesEmptyHint}</Text>
          <Button label={s.findDrink} variant="secondary" onPress={() => router.navigate('/')} />
        </View>
      ) : null}

      {recipes.length > 0 ? (
        <View className="gap-2">
          {recipes.map((recipe) => (
            <DrinkRow
              key={recipe.id}
              name={recipe.name[locale]}
              detail={`${glassLabel[locale][recipe.glass]} · ${methodLabel[locale][recipe.method]}`}
              trailing={`${Math.round(estimateAbv(recipe, catalogIndex()))}%`}
              onPress={() => router.push(`/recipe/${recipe.id}`)}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
