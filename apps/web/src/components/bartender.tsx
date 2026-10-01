'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { Route } from 'next';
import Link from 'next/link';
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { AbvBadge } from '@/components/abv-badge';
import { getUi, type Locale } from '@/i18n/ui';
import {
  buildChatBody,
  type CardRecipe,
  createChatFetch,
  DAILY_LIMIT,
  errorKind,
  MAX_INPUT,
  parseToolRecipes,
  quotaText,
  type ToolName,
  toolNameOfPart,
} from '@/lib/bartender';
import { recipesById } from '@/lib/catalog';
import { useUserData } from '@/lib/use-user-data';

const button =
  'inline-flex min-h-11 items-center justify-center rounded-pill border px-5 text-sm font-semibold';
const primaryButton = `${button} border-primary bg-primary text-on-primary disabled:opacity-50`;
const ghostButton = `${button} border-line text-ink hover:bg-surface`;

interface AnyPart {
  type: string;
  text?: string;
  state?: string;
  output?: unknown;
}

/** Bartender chat page body. A client island: the page itself stays static. */
export function Bartender({ locale }: { locale: Locale }) {
  const { mode } = useUserData();
  // Session not known yet: render an empty column instead of flashing the signed-out state.
  if (mode === 'pending') return <div className="mx-auto min-h-[50dvh] w-full max-w-[760px]" />;
  if (mode !== 'signed-in') return <SignedOut locale={locale} />;
  return <Chat locale={locale} />;
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

const TOOL_ICON: Record<ToolName, ReactNode> = {
  get_my_bar: <path d="M5 3h14l-7 9zM12 12v9M8 21h8" />,
  what_can_i_make: <path d="M20 6 9 17l-5-5" />,
  search_recipes: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  get_recipe: <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM8 7h7" />,
  find_substitutes: <path d="M7 7h12l-3-3M17 17H5l3 3" />,
  recommend_now: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
};

function HelpIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-ink-muted"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" />
    </svg>
  );
}

function SignedOut({ locale }: { locale: Locale }) {
  const ui = getUi(locale).bartender;
  const signInHref =
    `/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/bartender`)}` as Route;
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col items-center gap-4 py-12 text-center">
      <HelpIcon />
      <h1 className="font-display text-3xl font-semibold leading-tight">{ui.signedOut.title}</h1>
      <p className="max-w-md text-ink-muted">{ui.signedOut.body}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link href={signInHref} className={primaryButton}>
          {ui.signedOut.signIn}
        </Link>
        <Link href={`/${locale}` as Route} className={ghostButton}>
          {ui.signedOut.today}
        </Link>
      </div>
    </div>
  );
}

function Chat({ locale }: { locale: Locale }) {
  const ui = getUi(locale).bartender;
  const [quota, setQuota] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: '/api/ai/chat',
        credentials: 'same-origin',
        fetch: createChatFetch((i, init) => fetch(i, init), setQuota),
        prepareSendMessagesRequest: ({ messages }) => ({
          body: buildChatBody(messages, locale, new Date()),
        }),
      }),
  );
  const { messages, sendMessage, regenerate, stop, setMessages, clearError, status, error } =
    useChat({ transport });

  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const busy = status === 'submitted' || status === 'streaming';
  const kind = error ? errorKind(error) : null;
  const limited = kind === 'limit' || quota === 0;

  // Keep the newest content in view unless the reader scrolled up.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on every message update
  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [messages, status, error]);

  if (kind === 'unauthorized') return <SignedOut locale={locale} />;

  const send = (text: string) => {
    const trimmed = text.trim().slice(0, MAX_INPUT);
    if (!trimmed || busy || limited) return;
    pinned.current = true;
    void sendMessage({ text: trimmed });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
    setInput('');
  };

  const newChat = () => {
    stop();
    setMessages([]);
    clearError();
    setInput('');
  };

  const last = messages[messages.length - 1];
  const waitingForText =
    busy &&
    (last?.role !== 'assistant' ||
      !(last.parts as AnyPart[]).some((p) => p.type === 'text' && p.text));
  const quotaLine = quotaText(quota, { left: ui.quotaLeft, none: ui.quotaNone });

  return (
    <div className="mx-auto flex h-[calc(100dvh-13rem)] min-h-[30rem] w-full max-w-[760px] flex-col">
      <div className="flex min-h-11 items-center justify-between gap-3 pb-2">
        <h1 className="font-display text-xl font-semibold">{ui.title}</h1>
        {messages.length > 0 && (
          <button type="button" onClick={newChat} className={ghostButton}>
            {ui.newChat}
          </button>
        )}
      </div>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 overflow-y-auto py-2"
      >
        {messages.length === 0 && !error ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <h2 className="font-display text-3xl font-semibold leading-tight">{ui.heading}</h2>
            <p className="max-w-md text-ink-muted">{ui.lead}</p>
            <ul className="mt-2 flex flex-wrap justify-center gap-2">
              {ui.starters.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    disabled={limited}
                    onClick={() => send(s)}
                    className="inline-flex min-h-11 items-center rounded-pill border border-line bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-raised disabled:opacity-50"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div
            role="log"
            aria-live="polite"
            aria-label={ui.conversation}
            className="flex flex-col gap-6"
          >
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-lg bg-surface-raised px-4 py-2">
                    {(m.parts as AnyPart[]).map((p) => (p.type === 'text' ? p.text : '')).join('')}
                  </p>
                </div>
              ) : (
                <AssistantMessage key={m.id} parts={m.parts as AnyPart[]} locale={locale} />
              ),
            )}
            {waitingForText && (
              <div role="status" className="flex flex-col gap-2" aria-label={ui.thinking}>
                <div className="h-4 w-4/5 animate-pulse rounded-pill bg-surface" />
                <div className="h-4 w-3/5 animate-pulse rounded-pill bg-surface" />
              </div>
            )}
            {kind === 'limit' && (
              <div role="status" className="rounded-md bg-surface p-4">
                <p className="font-semibold">{ui.limit.title(DAILY_LIMIT)}</p>
                <p className="mt-1 text-sm text-ink-muted">{ui.limit.body}</p>
                <Link href={`/${locale}` as Route} className={`${ghostButton} mt-3`}>
                  {ui.limit.today}
                </Link>
              </div>
            )}
            {(kind === 'failed' || kind === 'busy') && (
              <div role="status" className="rounded-md border border-danger bg-surface p-4">
                <p className="font-semibold">{kind === 'busy' ? ui.busy : ui.failed.title}</p>
                {kind === 'failed' && (
                  <p className="mt-1 text-sm text-ink-muted">{ui.failed.body}</p>
                )}
                <button
                  type="button"
                  onClick={() => void regenerate()}
                  className={`${ghostButton} mt-3`}
                >
                  {ui.failed.retry}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-line bg-bg pt-3">
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <label htmlFor="bartender-input" className="sr-only">
            {ui.inputLabel}
          </label>
          <input
            id="bartender-input"
            type="text"
            value={input}
            maxLength={MAX_INPUT}
            disabled={limited}
            autoComplete="off"
            placeholder={ui.placeholder}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-12 min-w-0 flex-1 rounded-pill border border-line bg-surface px-5 text-ink placeholder:text-ink-muted disabled:opacity-50"
          />
          {busy ? (
            <button type="button" onClick={() => stop()} className={`${ghostButton} min-h-12`}>
              {ui.stop}
            </button>
          ) : (
            <button
              type="submit"
              disabled={limited || !input.trim()}
              className={`${primaryButton} min-h-12 px-6`}
            >
              {ui.send}
            </button>
          )}
        </form>
        <div className="mt-2 flex flex-col gap-1 text-xs text-ink-muted sm:flex-row sm:justify-between sm:gap-4">
          <span className="tabular">{quotaLine}</span>
          <span className="sm:text-right">{ui.disclaimer}</span>
        </div>
      </div>
    </div>
  );
}

function AssistantMessage({ parts, locale }: { parts: AnyPart[]; locale: Locale }) {
  const ui = getUi(locale).bartender;
  return (
    <div className="flex flex-col gap-3">
      {parts.map((part, i) => {
        // Parts only append while streaming, so the index is a stable key.
        const key = `${part.type}-${i}`;
        if (part.type === 'text') {
          return part.text ? (
            <p key={key} className="whitespace-pre-wrap break-words">
              {part.text}
            </p>
          ) : null;
        }
        const tool = toolNameOfPart(part.type);
        if (!tool) return null;
        const pending = part.state === 'input-streaming' || part.state === 'input-available';
        const cards =
          part.state === 'output-available'
            ? parseToolRecipes(part.output, (id) => recipesById.has(id))
            : [];
        return (
          <div key={key} className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <Icon>{TOOL_ICON[tool]}</Icon>
              {pending ? ui.tools[tool].pending : ui.tools[tool].done}
            </p>
            {cards.length > 0 && (
              <ul className="flex flex-col gap-2">
                {cards.map((c) => (
                  <li key={c.id}>
                    <RecipeRow recipe={c} locale={locale} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RecipeRow({ recipe, locale }: { recipe: CardRecipe; locale: Locale }) {
  const ui = getUi(locale);
  const showMissing = recipe.status === 'missing' && recipe.missing.length > 0;
  return (
    <Link
      href={`/${locale}/recipes/${recipe.id}` as Route}
      className="flex min-h-11 items-start justify-between gap-3 rounded-md bg-surface p-3 hover:bg-surface-raised"
    >
      <span className="flex flex-col gap-1">
        <span className="font-display font-semibold leading-snug">{recipe.name}</span>
        {showMissing && (
          <span className="text-sm text-danger">
            {ui.bartender.missing(recipe.missing.join(', '))}
          </span>
        )}
      </span>
      <AbvBadge abv={recipe.abv} labels={ui.abv} />
    </Link>
  );
}
