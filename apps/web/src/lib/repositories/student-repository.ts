import { registrationKey } from '@correctio/domain'
import { z } from 'zod'
import type { Student } from '@/types/domain'
import type { StudentInput } from '@/lib/schemas'
import { studentSchema } from '@/lib/schemas'
import { createCollection, simulateLatency } from '@/lib/storage/collection'
import { StorageError } from '@/lib/storage/errors'
import { compareByLocale, createId } from '@/lib/utils'
import type { ApiClient, QueryParams } from './http/api-client'
import { parseEntity, parsePage } from './http/create-http-repository'
import { LARGEST_PAGE, readEveryPage } from './read-every-page'

export interface ImportResult {
  created: number
  skipped: number
}

/**
 * Students are scoped by class rather than by teacher, so they do not fit the
 * owned-repository factory and get their own contract. Every operation names
 * the class, because on the API a student is only ever reached through a class
 * the teacher owns (`/classes/:id/students/...`).
 */
export interface StudentRepository {
  /** The whole class, in name order: the screens and the answer sheets need every student, never a slice. */
  listByClass: (classId: string) => Promise<Student[]>
  /**
   * Everyone the class has had, in name order, the students removed from it
   * included and marked by `removedAt`. Removing keeps the record and the
   * grades (RF09), so the sheets and grades of an application go on naming
   * the student instead of "Aluno removido" (#161).
   */
  listWithRemoved: (classId: string) => Promise<Student[]>
  add: (classId: string, input: StudentInput) => Promise<Student>
  importMany: (classId: string, rows: StudentInput[]) => Promise<ImportResult>
  remove: (classId: string, id: string) => Promise<void>
  anonymize: (classId: string, id: string) => Promise<void>
}

const ANONYMIZED_NAME = 'Aluno anonimizado'

function anonymized(student: Student): Student {
  return {
    ...student,
    fullName: ANONYMIZED_NAME,
    registration: `ANON-${student.id.slice(0, 8)}`,
    email: undefined,
    anonymizedAt: new Date().toISOString(),
  }
}

export function createLocalStudentRepository(): StudentRepository {
  const collection = createCollection('students', studentSchema)

  /** Keyed by `registrationKey`, as the API's unique index compares, so the demo skips what production skips. */
  const registrationsIn = (classId: string, students: Student[]): Set<string> =>
    new Set(students.filter((item) => item.classId === classId).map((item) => registrationKey(item.registration)))

  const isTarget = (classId: string, id: string) => (item: Student) => item.classId === classId && item.id === id

  const updateById = (classId: string, id: string, transform: (student: Student) => Student): void => {
    const students = collection.readAll()
    const index = students.findIndex(isTarget(classId, id))
    const student = students[index]
    if (student === undefined) throw new StorageError('Aluno não encontrado.', 'not-found')
    collection.writeAll(students.with(index, transform(student)))
  }

  const everyoneIn = (classId: string): Student[] =>
    collection
      .readAll()
      .filter((item) => item.classId === classId)
      .toSorted((a, b) => compareByLocale(a.fullName, b.fullName))

  return {
    async listByClass(classId) {
      await simulateLatency()
      return everyoneIn(classId).filter((item) => item.removedAt === undefined)
    },

    async listWithRemoved(classId) {
      await simulateLatency()
      return everyoneIn(classId)
    },

    async add(classId, input) {
      await simulateLatency()
      const students = collection.readAll()

      if (registrationsIn(classId, students).has(registrationKey(input.registration))) {
        throw new StorageError(
          `A matrícula ${input.registration} já existe nesta turma.`,
          'conflict',
        )
      }

      const student: Student = { id: createId(), classId, ...input }
      collection.writeAll([...students, student])
      return student
    },

    async importMany(classId, rows) {
      await simulateLatency(600)
      const students = collection.readAll()
      const taken = registrationsIn(classId, students)

      const created: Student[] = []
      for (const row of rows) {
        const key = registrationKey(row.registration)
        if (taken.has(key)) continue
        taken.add(key)
        created.push({ id: createId(), classId, ...row })
      }

      collection.writeAll([...students, ...created])
      return { created: created.length, skipped: rows.length - created.length }
    },

    /**
     * Marks the student removed and keeps the record, as the API does (RF09):
     * deleting it here was how the demo lost the name on the sheets (#161).
     * The first removal keeps its date.
     */
    async remove(classId, id) {
      await simulateLatency()
      const target = isTarget(classId, id)
      const removedAt = new Date().toISOString()
      collection.writeAll(
        collection.readAll().map((item) => (target(item) && item.removedAt === undefined ? { ...item, removedAt } : item)),
      )
    },

    async anonymize(classId, id) {
      await simulateLatency()
      updateById(classId, id, anonymized)
    },
  }
}

/** A class fits in one request; a longer one takes more requests rather than losing students. */
export const STUDENTS_PER_PAGE = LARGEST_PAGE

const importResultSchema = z.object({
  created: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
})

/**
 * The students of the API, under `/classes/:id/students`, through the same
 * client as the classes. The API takes the teacher from the token and answers
 * 404 for a class of someone else, which reaches the screen as `not-found`.
 */
export function createHttpStudentRepository(api: ApiClient): StudentRepository {
  const studentsPath = (classId: string) => `/classes/${encodeURIComponent(classId)}/students`
  const studentPath = (classId: string, id: string) => `${studentsPath(classId)}/${encodeURIComponent(id)}`

  const readPage = async (classId: string, query: QueryParams) =>
    parsePage(studentSchema, await api.request('GET', studentsPath(classId), { query }))

  return {
    /** Paging stays on the server, and the screens still receive the whole class, as the local version gives it. */
    listByClass: (classId) => readEveryPage((page) => readPage(classId, { page, pageSize: STUDENTS_PER_PAGE })),

    listWithRemoved: (classId) =>
      readEveryPage((page) => readPage(classId, { page, pageSize: STUDENTS_PER_PAGE, includeRemoved: true })),

    async add(classId, input) {
      return parseEntity(studentSchema, await api.request('POST', studentsPath(classId), { body: input }))
    },

    async importMany(classId, rows) {
      return parseEntity(importResultSchema, await api.request('POST', `${studentsPath(classId)}/import`, { body: { rows } }))
    },

    async remove(classId, id) {
      await api.request('DELETE', studentPath(classId, id))
    },

    async anonymize(classId, id) {
      await api.request('POST', `${studentPath(classId, id)}/anonymize`)
    },
  }
}
