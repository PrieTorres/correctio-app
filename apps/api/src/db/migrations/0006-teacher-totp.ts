import { sql, type Kysely } from 'kysely'

/**
 * The optional second factor of a teacher's account, five group additions to
 * `users`.
 *
 * `totpPendingSecret` holds the secret shown in the QR Code until a code is
 * confirmed; only then does it move to `totpSecret` and `totpEnabledAt` get a
 * value, so the factor is never on before it was proved to work. Both secrets
 * are stored encrypted with the field cipher, never in plain text.
 *
 * `totpLastStep` is the last accepted 30 s time step, which makes a code good
 * for one use. `totpFailedAttempts` and `totpLockedUntil` bound the guesses on
 * an account: the limit lives in the database so it holds across instances and
 * cannot be dodged by changing address.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE users
    ADD COLUMN totpSecret VARCHAR(255) NULL AFTER emailVerifiedAt,
    ADD COLUMN totpPendingSecret VARCHAR(255) NULL AFTER totpSecret,
    ADD COLUMN totpEnabledAt DATETIME(3) NULL AFTER totpPendingSecret,
    ADD COLUMN totpLastStep INT NULL AFTER totpEnabledAt,
    ADD COLUMN totpFailedAttempts INT NOT NULL DEFAULT 0 AFTER totpLastStep,
    ADD COLUMN totpLockedUntil DATETIME(3) NULL AFTER totpFailedAttempts`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE users
    DROP COLUMN totpLockedUntil,
    DROP COLUMN totpFailedAttempts,
    DROP COLUMN totpLastStep,
    DROP COLUMN totpEnabledAt,
    DROP COLUMN totpPendingSecret,
    DROP COLUMN totpSecret`.execute(db)
}
