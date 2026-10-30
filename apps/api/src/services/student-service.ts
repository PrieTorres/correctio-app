import { randomUUID } from 'node:crypto'
import { registrationKey, studentInputSchema, type Class, type Student, type StudentInput } from '@correctio/domain'
import { z } from 'zod'
import { isDuplicateEntry } from '../db/errors'
import { API_ERROR_CODE, ApiError } from '../lib/api-error'
import { mergePatch } from '../lib/merge-patch'
import { booleanParam, parseListRequest, type Page } from '../lib/pagination'
import { parseRequest } from '../lib/parse-request'
import type { ClassRepository } from '../repositories/class-repository'
import { REGISTRATION_INDEX, type NewStudent, type StudentChanges, type StudentRepository } from '../repositories/student-repository'

/** The fields of the student form. `userId` and the rest of a `Student` never come from a request. */
const STUDENT_FIELDS = ['fullName', 'registration', 'email'] as const satisfies readonly (keyof StudentInput)[]

const CLASS_NOT_FOUND = 'Turma não encontrada.'
const CLASS_ARCHIVED = 'Esta turma está arquivada. Restaure a turma para adicionar ou importar alunos.'
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

/** Written for the screen, like the messages of the domain schemas, since `parseRequest` answers with them. */
const NO_ROWS = 'Envie ao menos um aluno para importar'

const importSchema = z.object(
  {
    rows: z
      .array(z.unknown(), { required_error: NO_ROWS, invalid_type_error: NO_ROWS })
      .min(1, NO_ROWS)
      .max(MAX_IMPORT_ROWS, `Importe no máximo ${MAX_IMPORT_ROWS} alunos por vez`),
  },
  { invalid_type_error: NO_ROWS },
)

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
 * Validates one row with the schema of the student form and says which row it
 * is: the message of the form alone would not tell the teacher where to look
 * in a list of forty.
 */
function parseRow(row: unknown, index: number): StudentInput {
  try {
    return parseRequest(studentInputSchema, row)
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    throw new ApiError(API_ERROR_CODE.INVALID, `Linha ${index + 1} da importação: ${error.message}. Nada foi importado.`)
  }
}

function parseRows(body: unknown): StudentInput[] {
  return parseRequest(importSchema, body).rows.map((row, index) => parseRow(row, index))
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
 * it, and the screen has no way to bring the student back yet. The list leaves
 * the student out unless `includeRemoved=true` asks for everyone the class
 * had, which is how the sheets and the grades of an application keep the name.
 *
 * An archived class takes no new student, by adding or importing (decided by
 * the PM in #144). What it already has stays editable, removable and
 * anonymizable: the right to have personal data erased does not wait for the
 * class to be restored.
 */
export function createStudentService({ classes, students }: StudentServiceDependencies): StudentService {
  async function requireClass(teacherId: string, classId: string): Promise<Class> {
    const found = await classes.findById(teacherId, classId)
    if (found === undefined) throw new ApiError(API_ERROR_CODE.NOT_FOUND, CLASS_NOT_FOUND)
    return found
  }

  async function requireOpenClass(teacherId: string, classId: string): Promise<void> {
    if ((await requireClass(teacherId, classId)).status === 'archived') {
      throw new ApiError(API_ERROR_CODE.CONFLICT, CLASS_ARCHIVED)
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
      return students.list(classId, parseListRequest(query, { includeRemoved: booleanParam.default('false') }))
    },

    async add(teacherId, classId, body) {
      await requireOpenClass(teacherId, classId)
      const input = parseRequest(studentInputSchema, body)
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
      await requireOpenClass(teacherId, classId)
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

      const { merged, sent } = mergePatch(pickForm(current), body, STUDENT_FIELDS)
      const input = parseRequest(studentInputSchema, merged)
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
