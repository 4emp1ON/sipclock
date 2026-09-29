import { catalog } from '@sipclock/catalog';
import type { Ingredient, IngredientKind } from '@sipclock/domain';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { SearchInput } from '@/components/search-input';
import { Text } from '@/components/text';
import { useBar } from '@/hooks/use-bar';
import { currentLocale } from '@/lib/locale';
import { countMakeable } from '@/lib/makeable';
import { STARTER_BAR } from '@/lib/presets';
import { strings } from '@/lib/strings';

const KIND_ORDER: IngredientKind[] = [
  'spirit',
  'liqueur',
  'wine',
  'beer',
  'bitters',
  'syrup',
  'juice',
  'mixer',
  'fresh',
  'dairy',
  'pantry',
];

const PICKABLE = catalog.ingredients.filter((i) => !i.staple);

export default function MyBarScreen() {
  const locale = currentLocale();
  const s = strings[locale];
  const bar = useBar();
  const [query, setQuery] = useState('');
  const [confirmingClear, setConfirmingClear] = useState(false);

  const ids = bar.ids;
  const makeable = useMemo(() => countMakeable(ids ?? []), [ids]);

  const groups = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(locale);
    const matches = PICKABLE.filter(
      (i) =>
        !q || i.name.en.toLowerCase().includes(q) || i.name.ru.toLocaleLowerCase('ru').includes(q),
    );
    const byKind = new Map<IngredientKind, Ingredient[]>();
    for (const item of matches) byKind.set(item.kind, [...(byKind.get(item.kind) ?? []), item]);
    return KIND_ORDER.flatMap((kind) => {
      const items = byKind.get(kind);
      if (!items) return [];
      return [
        {
          kind,
          items: [...items].sort((a, b) => a.name[locale].localeCompare(b.name[locale], locale)),
        },
      ];
    });
  }, [query, locale]);

  const loading = ids === null;

  return (
    <Screen>
      <View className="gap-1">
        <Text variant="screen-title" accessibilityRole="header">
          {s.barTitle}
        </Text>
        <Text tone="muted" accessibilityLiveRegion="polite">
          {s.canMakeNow(makeable)}
        </Text>
        <Text variant="body-sm" tone="muted">
          {s.inBarCount(ids?.length ?? 0)}
        </Text>
      </View>

      <View className="flex-row gap-3">
        <Button
          label={s.starterBar}
          variant="secondary"
          className="flex-1"
          disabled={ids === null}
          onPress={() => bar.replaceAll(STARTER_BAR)}
        />
        <Button
          label={s.clearBar}
          variant="secondary"
          className="flex-1"
          disabled={ids === null}
          onPress={() => setConfirmingClear(true)}
        />
      </View>

      {confirmingClear ? (
        <View className="gap-3 rounded-lg border border-line bg-surface p-4">
          <Text>{s.clearConfirm}</Text>
          <View className="flex-row gap-3">
            <Button
              label={s.cancel}
              variant="secondary"
              className="flex-1"
              onPress={() => setConfirmingClear(false)}
            />
            <Button
              label={s.clearYes}
              className="flex-1"
              onPress={() => {
                bar.clear();
                setConfirmingClear(false);
              }}
            />
          </View>
        </View>
      ) : null}

      <SearchInput value={query} onChangeText={setQuery} placeholder={s.searchIngredients} />

      {groups.length === 0 ? <Text tone="muted">{s.noResults}</Text> : null}

      {groups.map((group) => (
        <View key={group.kind} className="gap-2">
          <Text variant="section-title" accessibilityRole="header">
            {s.kinds[group.kind]}
          </Text>
          {group.items.map((item) => {
            const selected = bar.has(item.id);
            return (
              <Pressable
                key={item.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected, disabled: loading }}
                disabled={loading}
                onPress={() => bar.toggle(item.id)}
                className={`min-h-12 flex-row items-center justify-between gap-3 rounded-lg border px-4 py-2 ${
                  selected ? 'border-primary bg-surface-raised' : 'border-line bg-surface'
                }`}
              >
                <Text variant="label" className="flex-1">
                  {item.name[locale]}
                </Text>
                <Text variant="label" tone={selected ? 'primary' : 'muted'}>
                  {selected ? '✓' : '+'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}
