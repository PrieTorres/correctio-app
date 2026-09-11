import type { Exam } from '@/types/domain'
import type { ExamInput } from '@/lib/schemas'
import { examSchema } from '@/lib/schemas'
import { createCollection, simulateLatency } from '@/lib/storage/collection'
import { StorageError } from '@/lib/storage/errors'
import { archiveByStatus, createOwnedRepository } from './create-owned-repository'
import type { OwnedRepository } from './types'

/**
 * `markReady` records that the exam has been applied at least once. It is a
 * fact about its history rather than something the form can set.
 */
export interface ExamRepository extends OwnedRepository<Exam, ExamInput> {
  markReady: (id: string) => Promise<void>
}

/**
 * Archiving restores to `draft`, never to `ready`.
 *
 * `ready` means the exam has been applied at least once, which is a fact about
 * its history rather than a state to hand back; an exam coming out of the
 * archive has no application waiting for it.
 */
export function createLocalExamRepository(teacherId: string): ExamRepository {
  const collection = createCollection('exams', examSchema)

  const base = createOwnedRepository<Exam, ExamInput>({
    collection,
    teacherId,
    label: 'Prova',
    archiving: archiveByStatus<Exam>('draft', 'closed'),
    toEntity: (input, base) => ({ ...base, ...input, status: 'draft' }),
    searchableFields: (item) => [item.title, item.description],
    sortKey: (item) => item.title,
  })

  return {
    ...base,

    async markReady(id) {
      await simulateLatency()
      const all = collection.readAll()
      const index = all.findIndex((item) => item.id === id && item.teacherId === teacherId)
      const exam = all[index]
      if (exam === undefined) throw new StorageError('Prova não encontrada.', 'not-found')

      if (exam.status === 'draft') collection.writeAll(all.with(index, { ...exam, status: 'ready' }))
    },
  }
}
