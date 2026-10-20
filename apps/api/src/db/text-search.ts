import { sql, type RawBuilder, type SqlBool } from 'kysely'

/**
 * Compares without accents or case, as `normalize` does in the web app: to the
 * teacher typing, "Cálculo" and "calculo" are the same word. Named in each query
 * instead of trusting the server default, which the hosted database could set
 * differently.
 */
const ACCENT_AND_CASE_INSENSITIVE = sql.raw('utf8mb4_0900_ai_ci')

/** Not a backslash, whose meaning inside a string literal depends on the SQL mode of the server. */
const LIKE_ESCAPE = '!'

/** A LIKE pattern that finds `term` anywhere, with the `%` and `_` the teacher typed taken literally. */
export function containsPattern(term: string): string {
  return `%${term.replace(/[!%_]/g, (char) => LIKE_ESCAPE + char)}%`
}

const OR_SEPARATOR = sql` OR `

/** True when any of `columns` contains `term`, ignoring accents and case. */
export function anyColumnContains(columns: readonly string[], term: string): RawBuilder<SqlBool> {
  const pattern = containsPattern(term)
  const matches = columns.map(
    (column) =>
      sql<SqlBool>`${sql.ref(column)} COLLATE ${ACCENT_AND_CASE_INSENSITIVE} LIKE ${pattern} ESCAPE ${sql.lit(LIKE_ESCAPE)}`,
  )
  return sql<SqlBool>`(${sql.join(matches, OR_SEPARATOR)})`
}

/** How a teacher types a day: as the screens print it, and as the date field of the form writes it. */
const DAY_FORMATS = ['%d/%m/%Y', '%Y-%m-%d'] as const

/**
 * True when the day of `column` contains `term`, written either way of
 * `DAY_FORMATS`, so "05/10" and "2026-10" both find the 5th of October. The
 * day is read in UTC, the zone of the connection, and the form stores noon UTC
 * of the day picked (`fromDateInputValue` in the web app), so it is that day.
 */
export function dayContains(column: string, term: string): RawBuilder<SqlBool> {
  const pattern = containsPattern(term)
  const matches = DAY_FORMATS.map(
    (format) => sql<SqlBool>`DATE_FORMAT(${sql.ref(column)}, ${format}) LIKE ${pattern} ESCAPE ${sql.lit(LIKE_ESCAPE)}`,
  )
  return sql<SqlBool>`(${sql.join(matches, OR_SEPARATOR)})`
}

/**
 * Equal ignoring accents, case and the spaces around, the identity rule of
 * `requireUnique` in the web app: "Cálculo I " and "calculo i" are one class.
 */
export function sameText(column: string, value: string): RawBuilder<SqlBool> {
  return sql<SqlBool>`TRIM(${sql.ref(column)}) COLLATE ${ACCENT_AND_CASE_INSENSITIVE} = TRIM(${value})`
}

/** Orders a list as a teacher reads it, with accents and case not moving a name. */
export function byText(column: string): RawBuilder<string> {
  return sql<string>`${sql.ref(column)} COLLATE ${ACCENT_AND_CASE_INSENSITIVE}`
}
