const LOCALE = 'pt-BR'

/**
 * Folds case and strips accents, so comparisons match what a person meant.
 *
 * Portuguese is typed without accents constantly — in a hurry, on a phone
 * keyboard, from muscle memory. Someone searching "calculo" is looking for
 * "Cálculo", and a search that answers "nothing found" is simply wrong. NFD
 * splits each accented letter into the letter plus its mark, which the
 * diacritic class then removes.
 */
export function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase(LOCALE)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

export function matchesSearch(term: string, ...fields: string[]): boolean {
  const needle = normalize(term)
  return needle === '' || fields.some((field) => normalize(field).includes(needle))
}

export function compareByLocale(a: string, b: string): number {
  return a.localeCompare(b, LOCALE)
}
