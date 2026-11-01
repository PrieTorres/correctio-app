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

/** The first word of a full name, or an empty string when there is no name to greet. */
export function firstName(fullName: string | undefined): string {
  return fullName?.trim().split(/\s+/)[0] ?? ''
}

/** Long enough to tell two questions apart, short enough to be read out as part of a button's name. */
const EXCERPT_LENGTH = 60

/**
 * The opening words of a text, cut at a word and marked with an ellipsis when
 * there is more, with its line breaks folded into spaces. Used where a whole
 * question statement would be too long to say, such as the name of a button
 * that acts on that question.
 */
export function excerpt(text: string, maxLength = EXCERPT_LENGTH): string {
  const flat = text.trim().replace(/\s+/g, ' ')
  if (flat.length <= maxLength) return flat

  const cut = flat.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:]+$/, '')}…`
}
