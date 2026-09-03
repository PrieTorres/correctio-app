import type { Student } from '@/types/domain'
import type { StudentInput } from '@/lib/schemas'
import { studentSchema } from '@/lib/schemas'
import { createCollection, simulateLatency } from '@/lib/storage/collection'
import { StorageError } from '@/lib/storage/errors'
import { compareByLocale, createId } from '@/lib/utils'

export interface ImportResult {
  created: number
  skipped: number
}

/**
 * Students are scoped by class rather than by teacher, so they do not fit the
 * owned-repository factory and get their own contract.
 */
export interface StudentRepository {
  listByClass: (classId: string) => Promise<Student[]>
  add: (classId: string, input: StudentInput) => Promise<Student>
  importMany: (classId: string, rows: StudentInput[]) => Promise<ImportResult>
  remove: (id: string) => Promise<void>
  anonymize: (id: string) => Promise<void>
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

  const registrationsIn = (classId: string, students: Student[]): Set<string> =>
    new Set(students.filter((item) => item.classId === classId).map((item) => item.registration))

  const updateById = (id: string, transform: (student: Student) => Student): void => {
    const students = collection.readAll()
    const index = students.findIndex((item) => item.id === id)
    if (index === -1) throw new StorageError('Aluno não encontrado.', 'not-found')
    collection.writeAll(students.with(index, transform(students[index]!)))
  }

  return {
    async listByClass(classId) {
      await simulateLatency()
      return collection
        .readAll()
        .filter((item) => item.classId === classId)
        .toSorted((a, b) => compareByLocale(a.fullName, b.fullName))
    },

    async add(classId, input) {
      await simulateLatency()
      const students = collection.readAll()

      if (registrationsIn(classId, students).has(input.registration)) {
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
        if (taken.has(row.registration)) continue
        taken.add(row.registration)
        created.push({ id: createId(), classId, ...row })
      }

      collection.writeAll([...students, ...created])
      return { created: created.length, skipped: rows.length - created.length }
    },

    async remove(id) {
      await simulateLatency()
      collection.writeAll(collection.readAll().filter((item) => item.id !== id))
    },

    async anonymize(id) {
      await simulateLatency()
      updateById(id, anonymized)
    },
  }
}
