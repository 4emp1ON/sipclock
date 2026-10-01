import { ingredientsById } from '@sipclock/catalog';
import type { Recipe } from '@sipclock/domain';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, View } from 'react-native';

import { useAccount } from '@/hooks/use-account';
import { useTheme } from '@/hooks/use-theme';
import { AiError, fetchSubstitutes, type SubstitutesResult } from '@/lib/ai';
import { endpoints, refreshSession, sessionCookie } from '@/lib/auth';
import { currentLocale, ingredientName } from '@/lib/locale';
import { strings } from '@/lib/strings';
import { Button } from './button';
import { Chip } from './chip';
import { Text } from './text';

type State =
  | { status: 'idle' }
  | { status: 'loading'; ingredient: string }
  | { status: 'done'; ingredient: string; result: SubstitutesResult }
  | { status: 'error'; ingredient: string };

/** "Find a swap" under the ingredient list: sign-in prompt for guests, otherwise chips and suggestions. */
export function SwapFinder({ recipe, barIds }: { recipe: Recipe; barIds: readonly string[] }) {
  const locale = currentLocale();
  const s = strings[locale];
  const { colors } = useTheme();
  const { user } = useAccount();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: 'idle' });
  // Only the latest request may update the screen.
  const requestId = useRef(0);
  useEffect(
    () => () => {
      requestId.current += 1;
    },
    [],
  );

  const inBar = new Set(barIds);
  const candidates = recipe.ingredients
    // Staples (ice, water) are in every bar: nothing to swap.
    .filter((i) => !i.garnish && ingredientsById.get(i.ingredient)?.staple !== true)
    .map((i) => i.ingredient)
    .sort((a, b) => Number(inBar.has(a)) - Number(inBar.has(b)));

  const load = (ingredient: string) => {
    const id = ++requestId.current;
    setState({ status: 'loading', ingredient });
    AccessibilityInfo.announceForAccessibility(s.swapLoading);
    fetchSubstitutes(
      { apiUrl: endpoints.api, getCookie: sessionCookie },
      { recipeId: recipe.id, ingredientId: ingredient, bar: [...barIds], locale },
    )
      .then((result) => {
        if (id !== requestId.current) return;
        setState({ status: 'done', ingredient, result });
        AccessibilityInfo.announceForAccessibility(s.swapCount(result.suggestions.length));
      })
      .catch((e) => {
        if (id !== requestId.current) return;
        if (e instanceof AiError && e.kind === 'unauthorized') {
          refreshSession();
          setOpen(false);
          setState({ status: 'idle' });
          return;
        }
        setState({ status: 'error', ingredient });
        AccessibilityInfo.announceForAccessibility(s.swapError);
      });
  };

  if (!user) {
    return (
      <View className="gap-2">
        <Button label={s.swapFind} variant="secondary" onPress={() => router.push('/sign-in')} />
        <Text variant="body-sm" tone="muted">
          {s.swapSignInHint}
        </Text>
      </View>
    );
  }

  if (!open) {
    return <Button label={s.swapFind} variant="secondary" onPress={() => setOpen(true)} />;
  }

  const current = state.status === 'idle' ? null : state.ingredient;
  const result = state.status === 'done' ? state.result : null;
  const quotaReached = result?.source === 'catalog' && result.quotaRemaining === 0;

  return (
    <View className="gap-3">
      <Text variant="section-title" accessibilityRole="header">
        {s.swapFind}
      </Text>
      {candidates.length === 0 ? (
        <Text tone="muted">{s.swapNoIngredients}</Text>
      ) : (
        <>
          <Text variant="body-sm" tone="muted">
            {s.swapPick}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {candidates.map((c) => (
              <Chip
                key={c}
                label={ingredientName(c, locale)}
                accessibilityLabel={s.swapChipLabel(ingredientName(c, locale))}
                selected={current === c}
                onPress={() => state.status !== 'loading' && load(c)}
              />
            ))}
          </View>
        </>
      )}

      {state.status === 'loading' ? (
        <View
          className="min-h-12 items-center justify-center"
          accessibilityRole="progressbar"
          accessibilityLabel={s.swapLoading}
        >
          <ActivityIndicator color={colors.ink} />
        </View>
      ) : null}

      {state.status === 'error' ? (
        <View className="gap-2">
          <Text tone="danger">{s.swapError}</Text>
          <Button label={s.swapRetry} variant="secondary" onPress={() => load(state.ingredient)} />
        </View>
      ) : null}

      {result ? (
        <View className="gap-3">
          <Text variant="label">{s.swapForTitle(ingredientName(result.ingredientId, locale))}</Text>
          {result.source === 'ai' ? (
            <Text variant="body-sm" tone="accent">
              {s.swapAi}
            </Text>
          ) : null}
          {quotaReached ? (
            <Text variant="body-sm" tone="muted">
              {s.swapQuotaReached}
            </Text>
          ) : null}
          {result.suggestions.length === 0 ? <Text tone="muted">{s.swapEmpty}</Text> : null}
          {result.suggestions.slice(0, 3).map((sug) => (
            <View
              key={sug.ingredientId}
              accessible
              className="gap-1 rounded-lg border border-line bg-surface p-4"
            >
              <Text variant="label">{ingredientName(sug.ingredientId, locale)}</Text>
              <Text variant="body-sm" tone="muted">
                {sug.fit === 'close' ? s.swapFitClose : s.swapFitWorkable}
                {sug.inBar ? ` · ${s.swapInBar}` : ''}
              </Text>
              {sug.note ? <Text variant="body-sm">{sug.note}</Text> : null}
            </View>
          ))}
          {result.canSkip ? (
            <Text variant="body-sm" tone="muted">
              {s.swapCanSkip}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
