// Checks on model text before it reaches a user. The catalog names ingredients generically (ADR 0002:
// alcohol advertising is banned online in Russia, 38-FZ art. 21), so a brand in a model answer is a defect.

/**
 * Each brand with its Latin spelling(s) first, then the Cyrillic ones a Russian answer would use. Names
 * that are also generic (Martini the cocktail) are left out: dropping every note about a Martini costs more
 * than it protects.
 */
export const BRANDS: readonly (readonly string[])[] = [
  ['absolut', 'абсолют'],
  ['angostura', 'ангостура'],
  ['aperol', 'апероль'],
  ['bacardi', 'бакарди'],
  ['baileys', 'бейлис', 'бейлиз'],
  ['beefeater', 'бифитер'],
  ['bénédictine', 'benedictine', 'бенедиктин'],
  ['bombay', 'бомбей'],
  ['campari', 'кампари'],
  ['captain morgan', 'капитан морган'],
  ['chartreuse', 'шартрез'],
  ['cointreau', 'куантро'],
  ['disaronno', 'дисаронно'],
  ['drambuie', 'драмбуи'],
  ['fernet-branca', 'fernet branca', 'фернет-бранка', 'фернет бранка'],
  ['frangelico', 'франжелико'],
  ['galliano', 'гальяно'],
  ['grand marnier', 'гран марнье'],
  ['havana club', 'гавана клуб'],
  ["hendrick's", 'hendricks', 'хендрикс'],
  ['hennessy', 'хеннесси', 'хеннеси'],
  ['jack daniel', 'джек дэниел', 'джек дениел'],
  ['jägermeister', 'jagermeister', 'егермейстер', 'ягермейстер'],
  ['jameson', 'джеймсон', 'джеймесон'],
  ['jim beam', 'джим бим'],
  ['johnnie walker', 'джонни уокер'],
  ['kahlúa', 'kahlua', 'калуа'],
  ['lillet', 'лилле'],
  ['luxardo', 'луксардо'],
  ['malibu', 'малибу'],
  ['midori', 'мидори'],
  ['smirnoff', 'смирнофф'],
  ['st-germain', 'st germain', 'сен-жермен', 'сен жермен'],
  ['tanqueray', 'танкерей'],
];

// Russian nouns decline (Ангостура → Ангостуры, Апероль → Апероля): longer Cyrillic names match by stem.
const stem = (spelling: string) =>
  spelling.length > 6 && /\p{Script=Cyrillic}$/u.test(spelling)
    ? spelling.replace(/[аяьй]$/u, '')
    : spelling;
const BRAND_SPELLINGS = BRANDS.flat().map(stem);

const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/giu;

export function mentionsBrand(text: string): boolean {
  const lower = text.toLowerCase();
  return BRAND_SPELLINGS.some((brand) => lower.includes(brand));
}

/** Single line, no links, at most `max` characters (cut at a word boundary). */
export function cleanText(text: string, max: number): string {
  const flat = text.replace(URL_PATTERN, '').replace(/\s+/gu, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.–-]+$/u, '')}…`;
}

/** Does the text look like it is written in the expected language (Cyrillic for `ru`, Latin for `en`)? */
export function matchesLocale(text: string, locale: 'en' | 'ru'): boolean {
  const cyrillic = (text.match(/\p{Script=Cyrillic}/gu) ?? []).length;
  const latin = (text.match(/\p{Script=Latin}/gu) ?? []).length;
  if (cyrillic + latin === 0) return false;
  return locale === 'ru' ? cyrillic >= latin : latin > cyrillic;
}
