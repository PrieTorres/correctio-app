/**
 * How two registrations are compared, the way the unique index of `students`
 * compares them under `utf8mb4_0900_ai_ci`: without accents or case, but with
 * the spaces at the end, since that collation does not pad. Close enough to
 * skip what the index would refuse; the rare pair it misses (such as `ß`
 * against `ss`) is still refused by the index.
 *
 * Shared because the import preview of the web app and the import of the API
 * must agree on who is already in the class: when they disagree, the button
 * promises one count and the server creates another (#144).
 */
export function registrationKey(registration: string): string {
  return registration.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR')
}
