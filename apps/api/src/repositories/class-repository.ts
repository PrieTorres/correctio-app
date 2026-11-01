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
  /**
   * Active or archived classes, searched by name and subject, ordered by name,
   * each with its `studentCount` (#146).
   */
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

  /**
   * The students of each class of a page, in one grouped query rather than one
   * per card. A removed student left the class (RF09) and does not count; an
   * anonymized one is still enrolled, with the grades (RF38), and does, which
   * is how P5 counts them. A class with no student has no row, and counts 0.
   */
  async function countStudents(classIds: readonly string[]): Promise<Map<string, number>> {
    if (classIds.length === 0) return new Map()
    const rows = await db
      .selectFrom('students')
      .select('classId')
      .select((eb) => eb.fn.countAll<number>().as('students'))
      .where('classId', 'in', classIds)
      .where('removedAt', 'is', null)
      .groupBy('classId')
      .execute()
    return new Map(rows.map((row) => [row.classId, Number(row.students)]))
  }

  return {
    async list(teacherId, { search, archived, page, pageSize }) {
      const filtered = owned(teacherId)
        .where('status', '=', archived ? 'archived' : 'active')
        .$if(search !== '', (query) => query.where(anyColumnContains(['name', 'subject'], search)))

      const { total } = await filtered.select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirstOrThrow()
      const { limit, offset } = pageWindow({ page, pageSize })
      const items = await filtered.select(CLASS_COLUMNS).orderBy(byText('name')).orderBy('id').limit(limit).offset(offset).execute()
      const counts = await countStudents(items.map((item) => item.id))
      return { items: items.map((item) => ({ ...item, studentCount: counts.get(item.id) ?? 0 })), total: Number(total) }
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
