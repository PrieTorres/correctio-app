import type { Kysely } from 'kysely'
import type { Database } from '../models/tables'

export interface RefreshTokenRecord {
  id: string
  userId: string
  expiresAt: Date
  revokedAt: Date | null
}

export interface NewRefreshToken {
  id: string
  userId: string
  tokenHash: string
  deviceInfo: string | null
  expiresAt: Date
}

export interface RefreshTokenRepository {
  create: (token: NewRefreshToken) => Promise<void>
  findByHash: (tokenHash: string) => Promise<RefreshTokenRecord | null>
  /**
   * `false` when the token was already revoked. One conditional UPDATE checks
   * and revokes at once, so two refreshes racing with the same token cannot
   * both rotate it.
   */
  revoke: (id: string) => Promise<boolean>
  /** `logout-all`, a password reset and a detected reuse all end every session of the account. */
  revokeAllForUser: (userId: string) => Promise<void>
}

/** Only the hash of a refresh token is stored (`tokenHash` of the Spec): the table never holds a usable token. */
export function createRefreshTokenRepository(db: Kysely<Database>): RefreshTokenRepository {
  return {
    async create({ id, userId, tokenHash, deviceInfo, expiresAt }) {
      await db.insertInto('refresh_tokens').values({ id, userId, tokenHash, deviceInfo, issuedAt: new Date(), expiresAt, revokedAt: null }).execute()
    },

    async findByHash(tokenHash) {
      const row = await db
        .selectFrom('refresh_tokens')
        .select(['id', 'userId', 'expiresAt', 'revokedAt'])
        .where('tokenHash', '=', tokenHash)
        .executeTakeFirst()
      return row ?? null
    },

    async revoke(id) {
      const result = await db
        .updateTable('refresh_tokens')
        .set({ revokedAt: new Date() })
        .where('id', '=', id)
        .where('revokedAt', 'is', null)
        .executeTakeFirst()
      return result.numUpdatedRows === 1n
    },

    async revokeAllForUser(userId) {
      await db.updateTable('refresh_tokens').set({ revokedAt: new Date() }).where('userId', '=', userId).where('revokedAt', 'is', null).execute()
    },
  }
}
