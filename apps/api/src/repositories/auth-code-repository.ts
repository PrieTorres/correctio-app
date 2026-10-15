import { randomUUID } from 'node:crypto'
import type { Kysely } from 'kysely'
import type { AuthCodePurpose } from '../models/auth-code-purpose'
import type { Database } from '../models/tables'

export interface NewAuthCode {
  userId: string
  purpose: AuthCodePurpose
  codeHash: string
  expiresAt: Date
}

export interface AuthCodeRepository {
  create: (code: NewAuthCode) => Promise<void>
  /**
   * Marks the code used and answers its account, or `null` when the code is
   * unknown, already used, expired or meant for something else.
   */
  consume: (codeHash: string, purpose: AuthCodePurpose) => Promise<string | null>
}

export function createAuthCodeRepository(db: Kysely<Database>): AuthCodeRepository {
  return {
    async create({ userId, purpose, codeHash, expiresAt }) {
      await db.insertInto('auth_codes').values({ id: randomUUID(), userId, purpose, codeHash, expiresAt, usedAt: null }).execute()
    },

    /**
     * One conditional UPDATE does the check and the marking at once, so two
     * clicks on the same link cannot both get through: only one of them
     * changes the row.
     */
    async consume(codeHash, purpose) {
      const now = new Date()
      const result = await db
        .updateTable('auth_codes')
        .set({ usedAt: now })
        .where('codeHash', '=', codeHash)
        .where('purpose', '=', purpose)
        .where('usedAt', 'is', null)
        .where('expiresAt', '>', now)
        .executeTakeFirst()
      if (result.numUpdatedRows !== 1n) return null

      const row = await db.selectFrom('auth_codes').select('userId').where('codeHash', '=', codeHash).executeTakeFirst()
      return row?.userId ?? null
    },
  }
}
