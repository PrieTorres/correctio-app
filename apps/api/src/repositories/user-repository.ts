import type { UserRole } from '@correctio/domain'
import type { Kysely } from 'kysely'
import type { Database } from '../models/tables'

export interface UserRecord {
  id: string
  role: UserRole
  fullName: string
  email: string
  passwordHash: string
  createdAt: Date
  anonymizedAt: Date | null
  emailVerifiedAt: Date | null
}

export interface NewUser {
  id: string
  fullName: string
  email: string
  passwordHash: string
  emailVerifiedAt: Date | null
}

/** What anonymizing an account writes in place of the person (RF05). */
export interface AnonymizedUser {
  fullName: string
  email: string
  passwordHash: string
  at: Date
}

export interface UserRepository {
  /** The column's collation compares without case, so `Ana@X` and `ana@x` are the same account. */
  findByEmail: (email: string) => Promise<UserRecord | null>
  findById: (id: string) => Promise<UserRecord | null>
  /** `null` when the address already has an account, including one created a moment ago by a parallel request. */
  create: (user: NewUser) => Promise<UserRecord | null>
  /** Records proof of the inbox and, in the same write, the password that goes with it. */
  verifyEmail: (id: string, passwordHash: string) => Promise<void>
  /** `false` when the account was already anonymized: the first anonymization is the one that stays. */
  anonymize: (id: string, markers: AnonymizedUser) => Promise<boolean>
}

const COLUMNS = ['id', 'role', 'fullName', 'email', 'passwordHash', 'createdAt', 'anonymizedAt', 'emailVerifiedAt'] as const

const DUPLICATE_ENTRY = 'ER_DUP_ENTRY'

function isDuplicateEntry(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === DUPLICATE_ENTRY
}

/** Every account created through the API is a teacher: the student area is out of scope (`docs/Arquitetura.md`, section 9). */
export function createUserRepository(db: Kysely<Database>): UserRepository {
  const findById = async (id: string) =>
    (await db.selectFrom('users').select(COLUMNS).where('id', '=', id).executeTakeFirst()) ?? null

  return {
    findById,

    async findByEmail(email) {
      return (await db.selectFrom('users').select(COLUMNS).where('email', '=', email).executeTakeFirst()) ?? null
    },

    async create({ id, fullName, email, passwordHash, emailVerifiedAt }) {
      try {
        await db
          .insertInto('users')
          .values({ id, role: 'professor', fullName, email, passwordHash, anonymizedAt: null, emailVerifiedAt })
          .execute()
      } catch (error) {
        if (isDuplicateEntry(error)) return null
        throw error
      }
      return findById(id)
    },

    async verifyEmail(id, passwordHash) {
      await db.updateTable('users').set({ passwordHash, emailVerifiedAt: new Date() }).where('id', '=', id).execute()
    },

    async anonymize(id, { fullName, email, passwordHash, at }) {
      const result = await db
        .updateTable('users')
        .set({ fullName, email, passwordHash, anonymizedAt: at })
        .where('id', '=', id)
        .where('anonymizedAt', 'is', null)
        .executeTakeFirst()
      return result.numUpdatedRows === 1n
    },
  }
}
