import type { Exam } from '@/types/domain'
import type { DrawRequest, ExamInput } from '@/lib/schemas'
import { examSchema, questionSchema } from '@/lib/schemas'
import { drawQuestions, type DrawResult } from '@/lib/exams'
import { createCollection, simulateLatency } from '@/lib/storage/collection'
import { StorageError } from '@/lib/storage/errors'
import { archiveByStatus, createOwnedRepository } from './create-owned-repository'
import type { OwnedRepository } from './types'

export interface ExamRepository extends OwnedRepository<Exam, ExamInput> {
  /**
   * The automatic exam (RF16): a selection from the teacher's active questions,
   * leaving out `excludeIds`. Nothing is stored until the teacher saves the exam.
   */
  draw: (request: DrawRequest) => Promise<DrawResult>
}

/**
 * The browser version also records that the exam was applied at least once,
 * when the demo generates an application. It is a fact about the history of
 * the exam rather than something the form can set, and the API records it on
 * its own when it generates (#46).
 */
export interface LocalExamRepository extends ExamRepository {
  markReady: (id: string) => Promise<void>
}

/**
 * Archiving restores to `draft`, never to `ready`.
 *
 * `ready` means the exam has been applied at least once, which is a fact about
 * its history rather than a state to hand back; an exam coming out of the
 * archive has no application waiting for it.
 */
export function createLocalExamRepository(teacherId: string): LocalExamRepository {
  const collection = createCollection('exams', examSchema)

  const base = createOwnedRepository<Exam, ExamInput>({
    collection,
    teacherId,
    label: 'Prova',
    archiving: archiveByStatus<Exam>('draft', 'closed'),
    toEntity: (input, base) => ({ ...base, ...input, status: 'draft' }),
    searchableFields: (item) => [item.title, item.description],
    sortKey: (item) => item.title,
    /**
     * The title is how a teacher refers to an exam, so two with the same one
     * cannot be told apart in any list. Duplicating appends "(cópia)", which
     * keeps that feature working.
     */
    identity: (item) => item.title,
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

    /** The same draw the API runs, over this browser's questions, for the demo and the unit tests. */
    async draw({ excludeIds, ...criteria }) {
      await simulateLatency()
      const excluded = new Set(excludeIds)
      const bank = createCollection('questions', questionSchema)
        .readAll()
        .filter((question) => question.teacherId === teacherId && !excluded.has(question.id))
      return drawQuestions(bank, criteria)
    },
  }
}
