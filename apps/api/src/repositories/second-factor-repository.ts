import type { Kysely } from 'kysely'
import type { Database } from '../models/tables'

/** What the second factor of one account holds; both secrets are still encrypted. */
export interface SecondFactorRecord {
  secret: string | null
  pendingSecret: string | null
  lastStep: number | null
}

export interface AttemptLimit {
  maxAttempts: number
  lockMs: number
  now: Date
}

export interface SecondFactorRepository {
  find: (userId: string) => Promise<SecondFactorRecord | null>
  /** Stores a secret awaiting its first code; `false` when the factor is already on. */
  savePending: (userId: string, encryptedSecret: string) => Promise<boolean>
  /** Moves the pending secret to the confirmed one and records the step of the code that proved it; `false` without a pending secret. */
  enable: (userId: string, step: number, at: Date) => Promise<boolean>
  disable: (userId: string) => Promise<void>
  /** Records `step` as used; `false` when it is not newer than the last one, which is a replayed code. */
  acceptStep: (userId: string, step: number) => Promise<boolean>
  /**
   * Spends one attempt before the code is checked, in a single conditional
   * write, so parallel requests cannot all pass the limit before the first
   * failure is recorded. `false` when the account is locked.
   */
  reserveAttempt: (userId: string, limit: AttemptLimit) => Promise<boolean>
  clearAttempts: (userId: string) => Promise<void>
}

/** The secrets and counters of the second factor, kept apart from `UserRecord` so no ordinary read of a user carries a secret. */
export function createSecondFactorRepository(db: Kysely<Database>): SecondFactorRepository {
  return {
    async find(userId) {
      const row = await db
        .selectFrom('users')
        .select(['totpSecret', 'totpPendingSecret', 'totpLastStep'])
        .where('id', '=', userId)
        .executeTakeFirst()
      return row === undefined ? null : { secret: row.totpSecret, pendingSecret: row.totpPendingSecret, lastStep: row.totpLastStep }
    },

    async savePending(userId, encryptedSecret) {
      const result = await db
        .updateTable('users')
        .set({ totpPendingSecret: encryptedSecret })
        .where('id', '=', userId)
        .where('totpEnabledAt', 'is', null)
        .executeTakeFirst()
      return result.numUpdatedRows === 1n
    },

    async enable(userId, step, at) {
      const result = await db
        .updateTable('users')
        .set((eb) => ({
          totpSecret: eb.ref('totpPendingSecret'),
          totpPendingSecret: null,
          totpEnabledAt: at,
          totpLastStep: step,
          totpFailedAttempts: 0,
          totpLockedUntil: null,
        }))
        .where('id', '=', userId)
        .where('totpPendingSecret', 'is not', null)
        .where('totpEnabledAt', 'is', null)
        .executeTakeFirst()
      return result.numUpdatedRows === 1n
    },

    async disable(userId) {
      await db
        .updateTable('users')
        .set({
          totpSecret: null,
          totpPendingSecret: null,
          totpEnabledAt: null,
          totpLastStep: null,
          totpFailedAttempts: 0,
          totpLockedUntil: null,
        })
        .where('id', '=', userId)
        .execute()
    },

    async acceptStep(userId, step) {
      const result = await db
        .updateTable('users')
        .set({ totpLastStep: step })
        .where('id', '=', userId)
        .where((eb) => eb.or([eb('totpLastStep', 'is', null), eb('totpLastStep', '<', step)]))
        .executeTakeFirst()
      return result.numUpdatedRows === 1n
    },

    async reserveAttempt(userId, { maxAttempts, lockMs, now }) {
      await db
        .updateTable('users')
        .set({ totpFailedAttempts: 0, totpLockedUntil: null })
        .where('id', '=', userId)
        .where('totpLockedUntil', '<=', now)
        .execute()

      const reserved = await db
        .updateTable('users')
        .set((eb) => ({ totpFailedAttempts: eb('totpFailedAttempts', '+', 1) }))
        .where('id', '=', userId)
        .where('totpFailedAttempts', '<', maxAttempts)
        .executeTakeFirst()
      if (reserved.numUpdatedRows !== 1n) return false

      await db
        .updateTable('users')
        .set({ totpLockedUntil: new Date(now.getTime() + lockMs) })
        .where('id', '=', userId)
        .where('totpFailedAttempts', '>=', maxAttempts)
        .where('totpLockedUntil', 'is', null)
        .execute()
      return true
    },

    async clearAttempts(userId) {
      await db.updateTable('users').set({ totpFailedAttempts: 0, totpLockedUntil: null }).where('id', '=', userId).execute()
    },
  }
}
