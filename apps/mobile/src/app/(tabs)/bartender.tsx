import { recipesById } from '@sipclock/catalog';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { DrinkRow } from '@/components/drink-row';
import { Text } from '@/components/text';
import { useAccount } from '@/hooks/use-account';
import { useTheme } from '@/hooks/use-theme';
import { AiError } from '@/lib/ai';
import { endpoints, refreshSession, sessionCookie } from '@/lib/auth';
import {
  type ChatErrorKind,
  type ChatRecipe,
  type ChatTool,
  chatErrorKind,
  MAX_QUESTION_CHARS,
  sendChat,
} from '@/lib/chat';
import { currentLocale, ingredientName } from '@/lib/locale';
import { strings } from '@/lib/strings';
import { textStyle } from '@/lib/typography';

const SafeAreaView = withUniwind(RNSafeAreaView);

type Message =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; tools: ChatTool[] };

export default function BartenderScreen() {
  const locale = currentLocale();
  const s = strings[locale];
  const { colors } = useTheme();
  const { user, pending: accountPending } = useAccount();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<Exclude<ChatErrorKind, 'unauthorized'> | null>(null);
  const [quota, setQuota] = useState<number | null>(null);
  const scroll = useRef<ScrollView>(null);
  // Only the latest request may update the screen.
  const requestId = useRef(0);
  useEffect(
    () => () => {
      requestId.current += 1;
    },
    [],
  );

  /** Asks the API with `history` (which ends with the user's question). */
  const run = (history: Message[]) => {
    const id = ++requestId.current;
    setMessages(history);
    setError(null);
    setWaiting(true);
    AccessibilityInfo.announceForAccessibility(s.chatAnswering);
    sendChat(
      { apiUrl: endpoints.api, getCookie: sessionCookie },
      { messages: history.map(({ role, text }) => ({ role, text })), locale },
    )
      .then((answer) => {
        if (id !== requestId.current) return;
        setWaiting(false);
        if (answer.quotaRemaining !== null) setQuota(answer.quotaRemaining);
        setMessages([...history, { role: 'assistant', text: answer.text, tools: answer.tools }]);
        AccessibilityInfo.announceForAccessibility(answer.text);
      })
      .catch((e) => {
        if (id !== requestId.current) return;
        setWaiting(false);
        const kind = chatErrorKind(e);
        if (kind === 'unauthorized') {
          // The signed-out state takes over once the session is gone.
          refreshSession();
          setError('failed');
          return;
        }
        if (kind === 'quota') setQuota(0);
        setError(kind);
        const title =
          kind === 'quota' ? s.chatLimitTitle : kind === 'busy' ? s.chatBusyTitle : s.chatFailTitle;
        AccessibilityInfo.announceForAccessibility(title);
        if (!(e instanceof AiError)) console.warn('[chat] unexpected error', e);
      });
  };

  const limit = quota === 0 || error === 'quota';
  const ask = (raw: string) => {
    const text = raw.trim().slice(0, MAX_QUESTION_CHARS);
    if (!text || waiting || limit) return;
    setDraft('');
    run([...messages, { role: 'user', text }]);
  };
  const retry = () => {
    if (messages.at(-1)?.role === 'user') run(messages);
  };
  const reset = () => {
    requestId.current += 1;
    setMessages([]);
    setDraft('');
    setError(null);
    setWaiting(false);
  };

  const goSignIn = () => router.push('/sign-in');

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
        <ScrollView className="flex-1" contentContainerClassName="gap-6 px-5 pt-4 pb-8">
          <Text variant="screen-title" accessibilityRole="header">
            {s.bartenderTitle}
          </Text>
          {accountPending ? null : (
            <View className="gap-3 rounded-lg border border-line bg-surface p-5">
              <Text variant="drink-title">{s.chatSignedOutTitle}</Text>
              <Text tone="muted">{s.chatSignedOutHint}</Text>
              <Button label={s.chatSignIn} onPress={goSignIn} />
              <Button
                label={s.chatSeePick}
                variant="secondary"
                onPress={() => router.navigate('/')}
              />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const canSend = draft.trim() !== '' && !waiting && !limit;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        // Android draws edge to edge, so the window is not resized for the keyboard: pad on both platforms.
        behavior="padding"
      >
        <View className="flex-row items-center justify-between gap-3 px-5 pt-4 pb-2">
          <Text variant="screen-title" accessibilityRole="header" className="flex-1">
            {s.bartenderTitle}
          </Text>
          {messages.length > 0 ? <Chip label={s.chatNew} onPress={reset} /> : null}
        </View>

        <ScrollView
          ref={scroll}
          className="flex-1"
          contentContainerClassName="gap-4 px-5 pt-2 pb-4"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <View className="gap-3">
              <Text variant="section-title">{s.chatEmptyTitle}</Text>
              <Text tone="muted">{s.chatEmptyHint}</Text>
              <View className="flex-row flex-wrap gap-2">
                {s.chatStarters.map((q) => (
                  <Chip key={q} label={q} onPress={() => ask(q)} />
                ))}
              </View>
            </View>
          ) : null}

          {messages.map((m, i) =>
            m.role === 'user' ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: the conversation is append-only
              <View key={i} className="max-w-[85%] self-end rounded-lg bg-surface-raised px-4 py-3">
                <Text>{m.text}</Text>
              </View>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: the conversation is append-only
              <AssistantMessage key={i} message={m} />
            ),
          )}

          {waiting ? (
            <View
              className="flex-row items-center gap-3"
              accessibilityRole="progressbar"
              accessibilityLabel={s.chatAnswering}
            >
              <ActivityIndicator color={colors.ink} />
              <Text tone="muted">{s.chatAnswering}</Text>
            </View>
          ) : null}

          {limit && !waiting ? (
            <View className="gap-3 rounded-lg border border-line bg-surface p-5">
              <Text variant="drink-title">{s.chatLimitTitle}</Text>
              <Text tone="muted">{s.chatLimitHint}</Text>
              <Button
                label={s.chatSeePick}
                variant="secondary"
                onPress={() => router.navigate('/')}
              />
            </View>
          ) : null}

          {!limit && (error === 'failed' || error === 'busy') ? (
            <View className="gap-3 rounded-lg border border-line bg-surface p-5">
              <Text
                variant="drink-title"
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                {error === 'busy' ? s.chatBusyTitle : s.chatFailTitle}
              </Text>
              <Text tone="muted">{s.chatFailHint}</Text>
              <Button label={s.chatRetry} variant="secondary" onPress={retry} />
            </View>
          ) : null}
        </ScrollView>

        <View className="gap-2 border-line border-t bg-bg px-5 pt-3 pb-3">
          <View className="flex-row items-end gap-2">
            <TextInput
              accessibilityLabel={s.chatInputLabel}
              placeholder={s.chatPlaceholder}
              placeholderTextColor={colors['ink-muted']}
              className="max-h-28 min-h-12 flex-1 rounded-lg border border-line bg-surface px-4 py-3 text-ink"
              style={textStyle('body')}
              value={draft}
              onChangeText={setDraft}
              maxLength={MAX_QUESTION_CHARS}
              multiline
              // The return key sends; a question is one paragraph.
              submitBehavior="submit"
              returnKeyType="send"
              onSubmitEditing={() => {
                if (canSend) ask(draft);
              }}
              editable={!limit}
            />
            <Button label={s.chatSend} disabled={!canSend} onPress={() => ask(draft)} />
          </View>
          <Text variant="caption" tone="muted">
            {quota === null ? s.chatQuotaUnknown : s.chatQuotaLeft(quota)}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AssistantMessage({ message }: { message: Extract<Message, { role: 'assistant' }> }) {
  const locale = currentLocale();
  const s = strings[locale];
  const checked = [
    ...new Set(message.tools.flatMap((t) => (s.chatTools[t.tool] ? [s.chatTools[t.tool]] : []))),
  ];
  const recipes = message.tools.flatMap((t) => t.recipes);
  const seen = new Set<string>();
  const cards = recipes.filter((r) => !seen.has(r.id) && seen.add(r.id));

  return (
    <View className="gap-2">
      {checked.length > 0 ? (
        <Text variant="caption" tone="muted">
          {checked.join(' · ')}
        </Text>
      ) : null}
      {cards.map((r) => (
        <RecipeCard key={r.id} recipe={r} />
      ))}
      <Text>{message.text}</Text>
    </View>
  );
}

function RecipeCard({ recipe }: { recipe: ChatRecipe }) {
  const locale = currentLocale();
  const s = strings[locale];
  const detail =
    recipe.status === 'ready'
      ? s.availReady
      : recipe.status === 'missing' && recipe.missing.length > 0
        ? s.availMissing(recipe.missing.map((id) => ingredientName(id, locale)).join(', '))
        : recipe.status === 'swap' && recipe.missing.length > 0
          ? s.availSwap(recipe.missing.length)
          : null;
  return (
    <DrinkRow
      name={recipesById.get(recipe.id)?.name[locale] ?? recipe.name}
      detail={detail}
      trailing={`${Math.round(recipe.abv)}%`}
      onPress={() => router.push(`/recipe/${recipe.id}`)}
    />
  );
}
