import { readFileSync } from 'node:fs';
import { type CountryResponse, Reader } from 'mmdb-lib';

/** ISO 3166-1 alpha-2 country of an IP address, or `undefined` when unknown. */
export type CountryLookup = (ip: string) => string | undefined;

export const unknownCountry: CountryLookup = () => undefined;

/** Country lookup over a MaxMind-format database (DB-IP Lite country). */
export function createCountryLookup(path: string): CountryLookup {
  const reader = new Reader<CountryResponse>(readFileSync(path));
  return (ip) => {
    try {
      return reader.get(ip)?.country?.iso_code;
    } catch {
      // Not an IP address ('unknown', malformed forwarded value).
      return undefined;
    }
  };
}

/**
 * Countries that pin an account to Yandex: Russia (the Anthropic API is not offered there and 152-FZ keeps
 * Russian users' data in Russia) and Belarus, where Russian users commonly resolve.
 */
export const RU_COUNTRIES: ReadonlySet<string> = new Set(['RU', 'BY']);

/**
 * Countries never sent to Claude: the pinning ones plus others outside Anthropic's supported regions. A
 * conservative subset of that list; a wrong guess only costs a provider switch.
 */
export const CLAUDE_EXCLUDED: ReadonlySet<string> = new Set([
  ...RU_COUNTRIES,
  'CN',
  'HK',
  'MO',
  'IR',
  'KP',
  'CU',
  'SY',
]);

export interface RegionSignals {
  country: string | undefined;
  /** Primary language the client asked for (`Accept-Language` or the request body). */
  locale: string | undefined;
  /** The account was already pinned to the Russian provider. */
  pinned: boolean;
}

export type Provider = 'yandex' | 'anthropic';

export interface RegionDecision {
  provider: Provider;
  /** This request is evidence of a Russian user; pin the account so later requests stay on Yandex. */
  pin: boolean;
}

/**
 * Picks the provider for a request (docs/adr/0007). Claude only for a known, non-Russian country, a
 * non-Russian locale and an account never pinned to Russia; everything uncertain goes to Yandex.
 */
export function decideRegion(signals: RegionSignals, anthropicEnabled: boolean): RegionDecision {
  const ruCountry = signals.country !== undefined && RU_COUNTRIES.has(signals.country);
  const ruLocale = signals.locale?.toLowerCase().startsWith('ru') === true;
  const pin = !signals.pinned && (ruCountry || ruLocale);
  const claude =
    anthropicEnabled &&
    !signals.pinned &&
    !ruLocale &&
    signals.country !== undefined &&
    !CLAUDE_EXCLUDED.has(signals.country);
  return { provider: claude ? 'anthropic' : 'yandex', pin };
}

/** First language tag of an `Accept-Language` header (`ru-RU,ru;q=0.9` → `ru-RU`). */
export function primaryLanguage(header: string | undefined): string | undefined {
  const first = header?.split(',')[0]?.split(';')[0]?.trim();
  return first ? first : undefined;
}
