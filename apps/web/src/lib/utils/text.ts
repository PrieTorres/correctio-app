const LOCALE = 'pt-BR'

export function normalize(value: string): string {
  return value.trim().toLocaleLowerCase(LOCALE)
}

export function matchesSearch(term: string, ...fields: string[]): boolean {
  const needle = normalize(term)
  return needle === '' || fields.some((field) => normalize(field).includes(needle))
}

export function compareByLocale(a: string, b: string): number {
  return a.localeCompare(b, LOCALE)
}
