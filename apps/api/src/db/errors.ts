interface DriverError {
  code?: unknown
  sqlMessage?: unknown
}

/**
 * Whether MySQL refused a row because a unique index already holds its value,
 * optionally a specific index. The index is the last word on duplicates: a
 * lookup made before writing can race with another request, and it compares
 * text by its own rules, which the index applies for certain.
 */
export function isDuplicateEntry(error: unknown, index?: string): boolean {
  if (typeof error !== 'object' || error === null) return false

  const { code, sqlMessage } = error as DriverError
  if (code !== 'ER_DUP_ENTRY') return false
  return index === undefined || (typeof sqlMessage === 'string' && sqlMessage.includes(`.${index}'`))
}
