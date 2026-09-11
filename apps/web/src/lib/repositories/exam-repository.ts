import type { Exam } from '@/types/domain'
import type { ExamInput } from '@/lib/schemas'
import { examSchema } from '@/lib/schemas'
import { createCollection } from '@/lib/storage/collection'
import { archiveByStatus, createOwnedRepository } from './create-owned-repository'
import type { OwnedRepository } from './types'

export type ExamRepository = OwnedRepository<Exam, ExamInput>

/**
 * Archiving restores to `draft`, never to `ready`.
 *
 * `ready` means the exam has been applied at least once, which is a fact about
 * its history rather than a state to hand back; an exam coming out of the
 * archive has no application waiting for it.
 */
export function createLocalExamRepository(teacherId: string): ExamRepository {
  return createOwnedRepository<Exam, ExamInput>({
    collection: createCollection('exams', examSchema),
    teacherId,
    label: 'Prova',
    archiving: archiveByStatus<Exam>('draft', 'closed'),
    toEntity: (input, base) => ({ ...base, ...input, status: 'draft' }),
    searchableFields: (item) => [item.title, item.description],
    sortKey: (item) => item.title,
  })
}
