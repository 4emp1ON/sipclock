import { catalog, recipesById } from '@sipclock/catalog';
import { availability, createRecipeSearcher, estimateAbv } from '@sipclock/engine';
import { glassLabel } from '@sipclock/i18n';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { DrinkRow } from '@/components/drink-row';
import { SearchInput } from '@/components/search-input';
import { Text } from '@/components/text';
import { useBar } from '@/hooks/use-bar';
import { endpoints } from '@/lib/auth';
import { availabilityLabel } from '@/lib/availability-label';
import { currentLocale } from '@/lib/locale';
import { catalogIndex } from '@/lib/makeable';
import { type ApiSearchHit, fetchSearch, MAX_QUERY_CHARS } from '@/lib/search-api';
import {
  anyFilter,
  BROWSE_LIMIT,
  browseRecipes,
  filterHits,
  MIN_QUERY_CHARS,
  mergeHits,
  NO_FILTERS,
  type ResultHit,
  type SearchFilters,
  SUGGESTION_LIMIT,
} from '@/lib/search-results';
import { strings } from '@/lib/strings';

const SafeAreaView = withUniwind(RNSafeAreaView);

const DEBOUNCE_MS = 250;
const LOCAL_LIMIT = 30;

const searcher = createRecipeSearcher(catalogIndex());

export default function SearchScreen() {
  const locale = currentLocale();
  const s = strings[locale];
  const bar = useBar();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(NO_FILTERS);
  // The API's answer for one query; ignored unless it is for the query on screen.
  const [remote, setRemote] = useState<{ q: string; hits: ApiSearchHit[] } | null>(null);
  // Only the latest request may update the screen.
  const requestId = useRef(0);
  useEffect(
    () => () => {
      requestId.current += 1;
    },
    [],
  );

  const q = query.trim().slice(0, MAX_QUERY_CHARS);
  const searching = q.length >= MIN_QUERY_CHARS;

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const id = ++requestId.current;
    if (debounced.length < MIN_QUERY_CHARS) {
      setRemote(null);
      return;
    }
    fetchSearch({ apiUrl: endpoints.api }, { q: debounced, locale })
      .then((result) => {
        if (id === requestId.current) setRemote({ q: debounced, hits: result.results });
      })
      .catch(() => {
        // Offline, rate limited or a bad answer: the local results stay, without noise.
      });
  }, [debounced, locale]);

  const index = catalogIndex();
  const barIds = bar.ids;
  const barSet = useMemo(() => (barIds === null ? null : new Set(barIds)), [barIds]);

  const hits: ResultHit[] = useMemo(() => {
    if (!searching) return [];
    const local = searcher.search(q, { limit: LOCAL_LIMIT });
    const api = remote && remote.q === q ? remote.hits : null;
    return filterHits(mergeHits(local, api), filters, barSet, index);
  }, [searching, q, remote, filters, barSet, index]);

  const browse = useMemo(
    () =>
      searching
        ? []
        : browseRecipes(
            catalog.recipes,
            filters,
            barSet,
            index,
            anyFilter(filters) ? BROWSE_LIMIT : SUGGESTION_LIMIT,
          ),
    [searching, filters, barSet, index],
  );

  const rows: ResultHit[] = searching
    ? hits
    : browse.map((r) => ({ id: r.id, field: 'name' as const }));
  const filtered = anyFilter(filters);
  const noMatches = rows.length === 0 && (searching || filtered);
  const count = noMatches ? 0 : rows.length;

  const toggle = (key: keyof SearchFilters) => setFilters((f) => ({ ...f, [key]: !f[key] }));
  const clearFilters = () => setFilters(NO_FILTERS);

  // Announce the count once the query has settled, not on every keystroke.
  useEffect(() => {
    if (!searching || debounced !== q) return;
    AccessibilityInfo.announceForAccessibility(
      count === 0 ? s.searchNoMatches(q) : s.searchCount(count),
    );
  }, [searching, debounced, q, count, s]);

  const chips: { key: keyof SearchFilters; label: string }[] = [
    { key: 'canMake', label: s.filterCanMake },
    { key: 'alcoholFree', label: s.filterAlcoholFree },
    { key: 'under15', label: s.filterUnder15 },
    { key: 'highball', label: s.filterHighball },
  ];

  const heading = searching || filtered ? s.searchCount(count) : s.searchIdeas;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        // Android draws edge to edge, so the window is not resized for the keyboard: pad on both platforms.
        behavior="padding"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-5 pt-4 pb-8"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text variant="screen-title" accessibilityRole="header">
            {s.searchTitle}
          </Text>

          <SearchInput
            value={query}
            onChangeText={setQuery}
            placeholder={s.searchPlaceholder}
            accessibilityLabel={s.searchLabel}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            accessibilityLabel={s.searchFilters}
            contentContainerClassName="gap-2"
            className="-mx-5 grow-0"
          >
            <View className="w-3" />
            {chips.map((c) => (
              <Chip
                key={c.key}
                label={c.label}
                selected={filters[c.key]}
                onPress={() => toggle(c.key)}
              />
            ))}
            <View className="w-3" />
          </ScrollView>

          {noMatches ? (
            <View className="gap-3 rounded-lg border border-line bg-surface p-5">
              <Text variant="drink-title" accessibilityLiveRegion="polite">
                {searching ? s.searchNoMatches(q) : s.searchNoMatchesFiltered}
              </Text>
              <Text tone="muted">{s.searchNoMatchesHint}</Text>
              {filtered ? (
                <Button label={s.searchClearFilters} variant="secondary" onPress={clearFilters} />
              ) : null}
            </View>
          ) : (
            <View className="gap-2">
              {!searching && !filtered ? <Text tone="muted">{s.searchHint}</Text> : null}
              <Text variant="label" tone="muted" accessibilityRole="header">
                {heading}
              </Text>
              {rows.map((hit) => {
                const recipe = recipesById.get(hit.id);
                if (!recipe) return null;
                const pill = availabilityLabel(availability(recipe, barSet, index), locale);
                const detail = [
                  hit.field === 'meaning' ? s.searchSimilar : null,
                  glassLabel[locale][recipe.glass],
                  pill,
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <DrinkRow
                    key={hit.id}
                    name={recipe.name[locale]}
                    detail={detail}
                    abv={Math.round(estimateAbv(recipe, index))}
                    onPress={() => router.push(`/recipe/${hit.id}`)}
                  />
                );
              })}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
