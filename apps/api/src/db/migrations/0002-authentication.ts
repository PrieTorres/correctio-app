import { sql, type Kysely } from 'kysely'

/**
 * What the sign-in flows need beyond the specification, both group additions
 * to the data model.
 *
 * `auth_codes` holds the one-time codes: the password reset link and the code
 * that carries a Google sign-in back to the address it started from. Only the
 * SHA-256 of a code is stored, as with refresh tokens, so reading the table
 * never yields a usable code. `usedAt` makes each code good for one use.
 *
 * `users.emailVerifiedAt` records when someone proved they read the account's
 * inbox, through Google or a password reset. Until then, the password may have
 * been set by someone who typed another person's address at sign-up.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE users ADD COLUMN emailVerifiedAt DATETIME(3) NULL AFTER anonymizedAt`.execute(db)
  await sql`CREATE TABLE auth_codes (
    id VARCHAR(36) PRIMARY KEY,
    userId VARCHAR(36) NOT NULL,
    purpose ENUM('PASSWORD_RESET', 'GOOGLE_SIGN_IN') NOT NULL,
    codeHash CHAR(64) NOT NULL UNIQUE,
    expiresAt DATETIME(3) NOT NULL,
    usedAt DATETIME(3) NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_auth_codes_user FOREIGN KEY (userId) REFERENCES users (id)
  )`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS auth_codes`.execute(db)
  await sql`ALTER TABLE users DROP COLUMN emailVerifiedAt`.execute(db)
}
