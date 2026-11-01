/**
 * How MySQL compares text under `utf8mb4_0900_ai_ci`, the collation of every
 * column: without accents or case, but with the spaces at the end, since that
 * collation does not pad. Close enough to find what a unique index would
 * refuse before writing; the rare pair it misses (such as `ß` against `ss`) is
 * still refused by the index, so the API turns that refusal into a message too.
 */
export function collationKey(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR')
}
