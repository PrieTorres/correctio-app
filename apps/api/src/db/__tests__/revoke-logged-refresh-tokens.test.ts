import type { Kysely } from 'kysely'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase, DATABASE_TEST_URL, type TestDatabase } from '../../__tests__/test-database'
import type { Database } from '../../models/tables'
import { up } from '../migrations/0005-revoke-logged-refresh-tokens'

const DAY_MS = 24 * 60 * 60 * 1000
const REVOKED_BEFORE = new Date('2026-11-20T10:00:00.000Z')

const token = (id: string, expiresAt: Date, revokedAt: Date | null) => ({
  id,
  userId: 'ana',
  tokenHash: `hash-${id}`,
  deviceInfo: null,
  issuedAt: new Date(expiresAt.getTime() - 30 * DAY_MS),
  expiresAt,
  revokedAt,
})

describe.runIf(DATABASE_TEST_URL !== undefined)('migration 0005: revoke the refresh tokens the request log kept', () => {
  let database: TestDatabase
  let db: Kysely<Database>

  beforeAll(async () => {
    database = await createTestDatabase()
    db = database.db
    await db.insertInto('users').values({ id: 'ana', role: 'professor', fullName: 'Ana', email: 'ana@exemplo.edu.br', passwordHash: 'x' }).execute()
    const now = Date.now()
    await db
      .insertInto('refresh_tokens')
      .values([
        token('still-valid', new Date(now + 10 * DAY_MS), null),
        token('revoked-before', new Date(now + 10 * DAY_MS), REVOKED_BEFORE),
        token('expired', new Date(now - DAY_MS), null),
      ])
      .execute()

    await up(db as unknown as Kysely<unknown>)
  })

  afterAll(() => database.drop())

  const revokedAtOf = async (id: string) => (await db.selectFrom('refresh_tokens').select('revokedAt').where('id', '=', id).executeTakeFirstOrThrow()).revokedAt

  /** A token still valid may have been written to the log in `Set-Cookie`, so it can no longer open a session. */
  it('revokes every token that could still open a session', async () => {
    expect(await revokedAtOf('still-valid')).toBeInstanceOf(Date)
  })

  /** The date a token was revoked is what reuse detection compares against, so an earlier revocation keeps its own. */
  it('keeps the date of a token revoked before', async () => {
    expect(await revokedAtOf('revoked-before')).toEqual(REVOKED_BEFORE)
  })

  it('leaves an expired token as it was', async () => {
    expect(await revokedAtOf('expired')).toBeNull()
  })
})
