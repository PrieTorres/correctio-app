import type { Class, Student } from '@/types/domain'
import type { ClassInput } from '@/lib/schemas'
import { classSchema, studentSchema } from '@/lib/schemas'
import { createCollection } from '@/lib/storage/collection'
import { createInviteCode } from '@/lib/utils'
import { archiveByStatus, createOwnedRepository } from './create-owned-repository'
import type { ApiClient } from './http/api-client'
import { createHttpOwnedRepository } from './http/create-http-repository'
import type { OwnedRepository } from './types'

export type ClassRepository = OwnedRepository<Class, ClassInput>

/**
 * How many students each class has, counted as the API counts them (#146): a
 * removed student left the class and does not count, an anonymized one is
 * still enrolled and does.
 */
export function countStudentsByClass(students: readonly Pick<Student, 'classId' | 'removedAt'>[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const student of students) {
    if (student.removedAt !== undefined) continue
    counts.set(student.classId, (counts.get(student.classId) ?? 0) + 1)
  }
  return counts
}

/**
 * The classes of this browser, for the demo and the unit tests. The list
 * carries `studentCount` like the API's, read from the students of this
 * browser in one pass for the whole page.
 */
export function createLocalClassRepository(teacherId: string): ClassRepository {
  const students = createCollection('students', studentSchema)
  const owned = createOwnedRepository<Class, ClassInput>({
    collection: createCollection('classes', classSchema),
    teacherId,
    label: 'Turma',
    archiving: archiveByStatus<Class>('active', 'archived'),
    toEntity: (input, base) => ({
      ...base,
      ...input,
      status: 'active',
      inviteCode: createInviteCode(),
    }),
    searchableFields: (item) => [item.name, item.subject],
    sortKey: (item) => item.name,
    /** The same name in the same term is the same class, typed twice. */
    identity: (item) => `${item.name}|${item.term}`,
  })

  return {
    ...owned,
    async list(params) {
      const page = await owned.list(params)
      const counts = countStudentsByClass(students.readAll())
      return { ...page, items: page.items.map((item) => ({ ...item, studentCount: counts.get(item.id) ?? 0 })) }
    },
  }
}

/**
 * The classes of the API (#41). Search, the archive filter and paging run on
 * the server, and the duplicate check answers 409 with the same messages the
 * local version gives.
 */
export function createHttpClassRepository(api: ApiClient): ClassRepository {
  return createHttpOwnedRepository<Class, ClassInput>({ api, resource: '/classes', schema: classSchema })
}
