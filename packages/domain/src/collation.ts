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

/**
 * Whether `tags` holds `tag` in any spelling the database stores as the same
 * one. A question tagged "matematica" is about "Matemática": the bank's filter
 * already finds it, and the draw and the reports have to agree (#199).
 */
export function hasTag(tags: readonly string[], tag: string): boolean {
  const key = collationKey(tag)
  return tags.some((item) => collationKey(item) === key)
}

/** The tags once each, under the first spelling given, comparing as the database does. */
export function distinctTags(tags: readonly string[]): string[] {
  const seen = new Set<string>()
  return tags.filter((tag) => {
    const key = collationKey(tag)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
