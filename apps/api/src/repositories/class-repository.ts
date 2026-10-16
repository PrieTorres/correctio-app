import type { Class, ClassInput, ClassStatus } from '@correctio/domain'
import type { Kysely } from 'kysely'
import { anyColumnContains, byText, sameText } from '../db/text-search'
import { pageWindow, type Page, type PageRequest } from '../lib/pagination'
import type { Database } from '../models/tables'

/** The fields of `Class` in the contract; `createdAt` and `updatedAt` are technical and stay in the database. */
const CLASS_COLUMNS = ['id', 'teacherId', 'name', 'subject', 'term', 'status', 'inviteCode'] as const

export interface ClassClash {
  id: string
  status: ClassStatus
}

export interface ClassRepository {
  /** Active or archived classes, searched by name and subject, ordered by name. */
  list: (teacherId: string, request: PageRequest) => Promise<Page<Class>>
  findById: (teacherId: string, id: string) => Promise<Class | undefined>
  /** Another class of the teacher with the same name and term, archived ones included. */
  findClash: (teacherId: string, identity: Pick<ClassInput, 'name' | 'term'>, exceptId?: string) => Promise<ClassClash | undefined>
  insert: (entity: Class) => Promise<void>
  /** Writes only the columns in `changes`, so a field the request did not carry is never touched. */
  update: (teacherId: string, id: string, changes: Partial<ClassInput>) => Promise<void>
  setStatus: (teacherId: string, id: string, status: ClassStatus) => Promise<void>
}

/**
 * Every query is scoped by `teacherId` here, so no service can forget it: a class
 * of another teacher is simply not found (`docs/Seguranca_e_LGPD.md`, section 2).
 */
export function createClassRepository(db: Kysely<Database>): ClassRepository {
  const owned = (teacherId: string) => db.selectFrom('classes').where('teacherId', '=', teacherId)

  return {
    async list(teacherId, { search, archived, page, pageSize }) {
      const filtered = owned(teacherId)
        .where('status', '=', archived ? 'archived' : 'active')
        .$if(search !== '', (query) => query.where(anyColumnContains(['name', 'subject'], search)))

      const { total } = await filtered.select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirstOrThrow()
      const { limit, offset } = pageWindow({ page, pageSize })
      const items = await filtered.select(CLASS_COLUMNS).orderBy(byText('name')).orderBy('id').limit(limit).offset(offset).execute()
      return { items, total: Number(total) }
    },

    findById: (teacherId, id) => owned(teacherId).select(CLASS_COLUMNS).where('id', '=', id).executeTakeFirst(),

    findClash(teacherId, { name, term }, exceptId) {
      const sameIdentity = owned(teacherId).select(['id', 'status']).where(sameText('name', name)).where(sameText('term', term))
      return (exceptId === undefined ? sameIdentity : sameIdentity.where('id', '<>', exceptId)).executeTakeFirst()
    },

    async insert(entity) {
      await db.insertInto('classes').values(entity).execute()
    },

    async update(teacherId, id, changes) {
      if (Object.keys(changes).length === 0) return
      await db.updateTable('classes').set(changes).where('teacherId', '=', teacherId).where('id', '=', id).execute()
    },

    async setStatus(teacherId, id, status) {
      await db.updateTable('classes').set({ status }).where('teacherId', '=', teacherId).where('id', '=', id).execute()
    },
  }
}
