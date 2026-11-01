interface DriverError {
  code?: unknown
  sqlMessage?: unknown
}

/**
 * Whether MySQL refused a row because a unique index already holds its value,
 * optionally a specific index. The index is the last word on duplicates: a
 * lookup made before writing can race with another request, and it compares
 * text by its own rules, which the index applies for certain.
 *
 * MySQL names the index as `'<table>.<index>'`. A unique index is told apart
 * by its own name (`inviteCode`); a primary key is `PRIMARY` in every table,
 * so it is told apart by its table too (`question_tags.PRIMARY`).
 */
export function isDuplicateEntry(error: unknown, index?: string): boolean {
  if (typeof error !== 'object' || error === null) return false

  const { code, sqlMessage } = error as DriverError
  if (code !== 'ER_DUP_ENTRY') return false
  if (index === undefined) return true
  return typeof sqlMessage === 'string' && (sqlMessage.includes(`.${index}'`) || sqlMessage.includes(`'${index}'`))
}
