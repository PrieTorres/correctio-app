import { sql, type Kysely } from 'kysely'

/**
 * Ends every session that was still open when the request log stopped writing
 * headers. Until then each sign-in and refresh wrote the new refresh token, in
 * `Set-Cookie`, to the log, where anyone who reads the project's logs could
 * find it for the 30 days a token lives. Revoking the tokens still valid makes
 * those lines useless; each teacher signs in again once.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  const now = new Date()
  await sql`UPDATE refresh_tokens SET revokedAt = ${now} WHERE revokedAt IS NULL AND expiresAt > ${now}`.execute(db)
}

/** Rolling back leaves the tokens revoked: a token that went through the log cannot be trusted again. */
export function down(): Promise<void> {
  return Promise.resolve()
}
