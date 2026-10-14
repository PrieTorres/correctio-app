import { randomUUID } from 'node:crypto'
import { studentInputSchema, type Student, type StudentInput } from '@correctio/domain'
import { z } from 'zod'
import { isDuplicateEntry } from '../db/errors'
import { API_ERROR_CODE, ApiError } from '../lib/api-error'
import { parsePageRequest, type Page } from '../lib/pagination'
import { mergePatch, parseInput } from '../lib/validation'
import type { ClassRepository } from '../repositories/class-repository'
import { REGISTRATION_INDEX, type NewStudent, type StudentChanges, type StudentRepository } from '../repositories/student-repository'

/** The fields of the student form. `userId` and the rest of a `Student` never come from a request. */
const STUDENT_FIELDS = ['fullName', 'registration', 'email'] as const satisfies readonly (keyof StudentInput)[]

const STUDENT_DATA = 'Dados do aluno'
const IMPORT_DATA = 'Dados da importação'
const CLASS_NOT_FOUND = 'Turma não encontrada.'
const STUDENT_NOT_FOUND = 'Aluno não encontrado.'
const ANONYMIZED_LOCKED = 'Os dados deste aluno foram anonimizados e não podem mais ser editados.'
const IMPORT_CLASHED = 'Uma das matrículas já existe nesta turma. Nada foi importado: confira a lista e tente de novo.'

/** What anonymization writes, as the web app does today (`student-repository.ts` in `apps/web`). */
export const ANONYMIZED_NAME = 'Aluno anonimizado'
const anonymizedRegistration = (id: string) => `ANON-${id.slice(0, 8)}`

/**
 * One request writes one batch, in a single statement. A class list is a few
 * dozen rows; the ceiling only keeps a mistaken file from becoming a huge
 * statement, and the body limit of 100 KB already stops most of them earlier.
 */
const MAX_IMPORT_ROWS = 1000

const importSchema = z.object({ rows: z.array(z.unknown()).min(1).max(MAX_IMPORT_ROWS) })

export interface ImportResult {
  created: number
  skipped: number
}

export interface StudentService {
  list: (teacherId: string, classId: string, query: unknown) => Promise<Page<Student>>
  add: (teacherId: string, classId: string, body: unknown) => Promise<Student>
  importMany: (teacherId: string, classId: string, body: unknown) => Promise<ImportResult>
  update: (teacherId: string, classId: string, studentId: string, body: unknown) => Promise<Student>
  remove: (teacherId: string, classId: string, studentId: string) => Promise<void>
  anonymize: (teacherId: string, classId: string, studentId: string) => Promise<void>
}

export interface StudentServiceDependencies {
  classes: ClassRepository
  students: StudentRepository
}

/**
 * How the unique index compares a registration under `utf8mb4_0900_ai_ci`:
 * without accents or case, but with the spaces at the end, since that collation
 * does not pad. Close enough to skip what the index would refuse; the rare pair
 * it misses (such as `ß` against `ss`) is still refused by the index.
 */
function registrationKey(registration: string): string {
  return registration.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR')
}

function parseRows(body: unknown): StudentInput[] {
  const { rows } = parseInput(importSchema, body, IMPORT_DATA)
  return rows.map((row, index) => {
    const result = studentInputSchema.safeParse(row)
    if (result.success) return result.data
    const field = result.error.issues[0]?.path.join('.') || 'formato'
    throw new ApiError(API_ERROR_CODE.INVALID, `A linha ${index + 1} da importação é inválida: ${field}. Nada foi importado.`)
  })
}

function pickForm(student: Student): Partial<Record<(typeof STUDENT_FIELDS)[number], unknown>> {
  return { fullName: student.fullName, registration: student.registration, email: student.email }
}

/** Only the columns the client sent; a removed e-mail goes as `null`, which clears it. */
function changesFrom(input: StudentInput, sent: readonly (typeof STUDENT_FIELDS)[number][]): StudentChanges {
  const changes: StudentChanges = {}
  for (const field of sent) {
    if (field === 'email') changes.email = input.email ?? null
    else changes[field] = input[field]
  }
  return changes
}

/**
 * The rules of RF07, RF08, RF09 and RF38 on the server. Every route first
 * finds the class among the teacher's own, so a student of another teacher is
 * not found, never forbidden (`docs/Seguranca_e_LGPD.md`, section 2).
 *
 * A student removed from the class (RF09) keeps the record and its grades, and
 * keeps the registration taken too: the unique index of the class still holds
 * it, and the screen has no way to bring the student back yet.
 */
export function createStudentService({ classes, students }: StudentServiceDependencies): StudentService {
  async function requireClass(teacherId: string, classId: string): Promise<void> {
    if ((await classes.findById(teacherId, classId)) === undefined) {
      throw new ApiError(API_ERROR_CODE.NOT_FOUND, CLASS_NOT_FOUND)
    }
  }

  async function requireStudent(classId: string, studentId: string, includeRemoved = false): Promise<Student> {
    const student = includeRemoved
      ? await students.findIncludingRemoved(classId, studentId)
      : await students.findInClass(classId, studentId)
    if (student === undefined) throw new ApiError(API_ERROR_CODE.NOT_FOUND, STUDENT_NOT_FOUND)
    return student
  }

  /** Names who holds the registration, since a removed student holding it is not visible on the screen. */
  async function registrationConflict(classId: string, registration: string): Promise<ApiError> {
    const holder = await students.findByRegistration(classId, registration)
    const message =
      holder?.removedAt === undefined
        ? `A matrícula ${registration} já existe nesta turma.`
        : `A matrícula ${registration} é de um aluno removido desta turma.`
    return new ApiError(API_ERROR_CODE.CONFLICT, message)
  }

  /**
   * Writes and turns a registration refused by the unique index into a 409.
   * The index decides rather than a lookup before writing: it compares as
   * MySQL does, and no other request can slip in between.
   */
  async function writeRegistration(classId: string, registration: string, write: () => Promise<void>): Promise<void> {
    try {
      await write()
    } catch (error) {
      if (!isDuplicateEntry(error, REGISTRATION_INDEX)) throw error
      throw await registrationConflict(classId, registration)
    }
  }

  return {
    async list(teacherId, classId, query) {
      await requireClass(teacherId, classId)
      return students.list(classId, parsePageRequest(query))
    },

    async add(teacherId, classId, body) {
      await requireClass(teacherId, classId)
      const input = parseInput(studentInputSchema, body, STUDENT_DATA)
      const student: NewStudent = { id: randomUUID(), classId, ...input }
      await writeRegistration(classId, input.registration, () => students.insert([student]))
      return student
    },

    /**
     * Rows whose registration is already in the class, or repeats an earlier row,
     * are skipped and counted, as the web app does today. A row the schema
     * refuses stops the whole import, so the teacher fixes the list once.
     */
    async importMany(teacherId, classId, body) {
      await requireClass(teacherId, classId)
      const rows = parseRows(body)
      const taken = new Set((await students.registrationsIn(classId)).map(registrationKey))

      const fresh: NewStudent[] = []
      for (const row of rows) {
        const key = registrationKey(row.registration)
        if (taken.has(key)) continue
        taken.add(key)
        fresh.push({ id: randomUUID(), classId, ...row })
      }

      try {
        await students.insert(fresh)
      } catch (error) {
        if (!isDuplicateEntry(error, REGISTRATION_INDEX)) throw error
        throw new ApiError(API_ERROR_CODE.CONFLICT, IMPORT_CLASHED)
      }
      return { created: fresh.length, skipped: rows.length - fresh.length }
    },

    async update(teacherId, classId, studentId, body) {
      await requireClass(teacherId, classId)
      const current = await requireStudent(classId, studentId)
      if (current.anonymizedAt !== undefined) throw new ApiError(API_ERROR_CODE.CONFLICT, ANONYMIZED_LOCKED)

      const { merged, sent } = mergePatch(pickForm(current), body, STUDENT_FIELDS, STUDENT_DATA)
      const input = parseInput(studentInputSchema, merged, STUDENT_DATA)
      await writeRegistration(classId, input.registration, () => students.update(classId, studentId, changesFrom(input, sent)))
      return requireStudent(classId, studentId)
    },

    async remove(teacherId, classId, studentId) {
      await requireClass(teacherId, classId)
      await requireStudent(classId, studentId)
      await students.markRemoved(classId, studentId, new Date())
    },

    /**
     * Irreversible (RF38), and it applies to a removed student too: removing
     * keeps the personal data, and the right to have it erased still holds. A
     * second request finds nothing left to erase and changes nothing.
     */
    async anonymize(teacherId, classId, studentId) {
      await requireClass(teacherId, classId)
      const student = await requireStudent(classId, studentId, true)
      if (student.anonymizedAt !== undefined) return

      await students.anonymize(classId, studentId, {
        fullName: ANONYMIZED_NAME,
        registration: anonymizedRegistration(studentId),
        at: new Date(),
      })
    },
  }
}
