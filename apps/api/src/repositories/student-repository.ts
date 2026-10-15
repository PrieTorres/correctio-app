import type { Student } from '@correctio/domain'
import type { Kysely, Selectable } from 'kysely'
import { anyColumnContains, byText } from '../db/text-search'
import type { FieldCipher } from '../lib/field-encryption'
import { pageWindow, type Page, type PageRequest } from '../lib/pagination'
import type { Database, StudentsTable } from '../models/tables'

/** The fields of `Student` in the contract; `createdAt` and `updatedAt` are technical and stay in the database. */
const STUDENT_COLUMNS = ['id', 'classId', 'fullName', 'registration', 'email', 'anonymizedAt', 'userId', 'removedAt'] as const

/** The unique index of `0001-initial-schema`: one registration per class, removed students included. */
export const REGISTRATION_INDEX = 'uq_students_class_registration'

type StudentRow = Pick<Selectable<StudentsTable>, (typeof STUDENT_COLUMNS)[number]>

/** A student about to be written, with the e-mail still in plain text: it is encrypted only on the way in. */
export interface NewStudent {
  id: string
  classId: string
  fullName: string
  registration: string
  email?: string
}

/** The columns a PATCH may write. `email: null` removes the address; a key left out is not touched. */
export interface StudentChanges {
  fullName?: string
  registration?: string
  email?: string | null
}

export interface AnonymizedData {
  fullName: string
  registration: string
  at: Date
}

export interface StudentRepository {
  /** The students still in the class, searched by name and registration, ordered by name. */
  list: (classId: string, request: PageRequest) => Promise<Page<Student>>
  /** A student still in the class; one removed from it is not found. */
  findInClass: (classId: string, id: string) => Promise<Student | undefined>
  /** Finds a removed student too, for what still applies to them, such as anonymization. */
  findIncludingRemoved: (classId: string, id: string) => Promise<Student | undefined>
  /** Compared the way the unique index compares, so it finds the student the index refused. */
  findByRegistration: (classId: string, registration: string) => Promise<Student | undefined>
  /** Every registration taken in the class, removed students included, as the unique index sees them. */
  registrationsIn: (classId: string) => Promise<string[]>
  /** One statement, so a batch is written whole or not at all. */
  insert: (students: readonly NewStudent[]) => Promise<void>
  update: (classId: string, id: string, changes: StudentChanges) => Promise<void>
  markRemoved: (classId: string, id: string, at: Date) => Promise<void>
  anonymize: (classId: string, id: string, data: AnonymizedData) => Promise<void>
}

/**
 * Students belong to a class rather than to a teacher, so the repository scopes
 * by class; the service checks first that the class is the teacher's.
 *
 * The e-mail is encrypted on every write and decrypted on every read, here and
 * nowhere else, so the database never holds the address and the rest of the API
 * never handles the ciphertext (`docs/Seguranca_e_LGPD.md`, section 7). A field
 * the database has no value for is left out, which is the shape of the contract.
 */
export function createStudentRepository(db: Kysely<Database>, cipher: FieldCipher): StudentRepository {
  const toStudent = (row: StudentRow): Student => ({
    id: row.id,
    classId: row.classId,
    fullName: row.fullName,
    registration: row.registration,
    ...(row.email !== null && { email: cipher.decrypt(row.email) }),
    ...(row.anonymizedAt !== null && { anonymizedAt: row.anonymizedAt.toISOString() }),
    ...(row.userId !== null && { userId: row.userId }),
    ...(row.removedAt !== null && { removedAt: row.removedAt.toISOString() }),
  })

  const encryptedEmail = (email: string | null | undefined): string | null =>
    email === undefined || email === null ? null : cipher.encrypt(email)

  const inClass = (classId: string) => db.selectFrom('students').where('classId', '=', classId)

  const findOne = async (classId: string, id: string, includeRemoved: boolean) => {
    const row = await inClass(classId)
      .select(STUDENT_COLUMNS)
      .where('id', '=', id)
      .$if(!includeRemoved, (query) => query.where('removedAt', 'is', null))
      .executeTakeFirst()
    return row === undefined ? undefined : toStudent(row)
  }

  const changeRow = (classId: string, id: string) => db.updateTable('students').where('classId', '=', classId).where('id', '=', id)

  return {
    async list(classId, { search, page, pageSize }) {
      const filtered = inClass(classId)
        .where('removedAt', 'is', null)
        .$if(search !== '', (query) => query.where(anyColumnContains(['fullName', 'registration'], search)))

      const { total } = await filtered.select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirstOrThrow()
      const { limit, offset } = pageWindow({ page, pageSize })
      const rows = await filtered.select(STUDENT_COLUMNS).orderBy(byText('fullName')).orderBy('id').limit(limit).offset(offset).execute()
      return { items: rows.map(toStudent), total: Number(total) }
    },

    findInClass: (classId, id) => findOne(classId, id, false),

    findIncludingRemoved: (classId, id) => findOne(classId, id, true),

    async findByRegistration(classId, registration) {
      const row = await inClass(classId).select(STUDENT_COLUMNS).where('registration', '=', registration).executeTakeFirst()
      return row === undefined ? undefined : toStudent(row)
    },

    async registrationsIn(classId) {
      const rows = await inClass(classId).select('registration').execute()
      return rows.map((row) => row.registration)
    },

    async insert(students) {
      if (students.length === 0) return
      const rows = students.map((student) => ({
        id: student.id,
        classId: student.classId,
        fullName: student.fullName,
        registration: student.registration,
        email: encryptedEmail(student.email),
      }))
      await db.insertInto('students').values(rows).execute()
    },

    async update(classId, id, { email, ...plain }) {
      const columns = { ...plain, ...(email !== undefined && { email: encryptedEmail(email) }) }
      if (Object.keys(columns).length === 0) return
      await changeRow(classId, id).set(columns).execute()
    },

    async markRemoved(classId, id, at) {
      await changeRow(classId, id).set({ removedAt: at }).where('removedAt', 'is', null).execute()
    },

    async anonymize(classId, id, { fullName, registration, at }) {
      await changeRow(classId, id)
        .set({ fullName, registration, email: null, anonymizedAt: at })
        .where('anonymizedAt', 'is', null)
        .execute()
    },
  }
}
