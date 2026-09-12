import type { Question } from '@/types/domain'
import type { QuestionInput } from '@/lib/schemas'
import { questionSchema } from '@/lib/schemas'
import { createCollection } from '@/lib/storage/collection'
import { archiveByTimestamp, createOwnedRepository } from './create-owned-repository'
import type { OwnedRepository } from './types'

export type QuestionRepository = OwnedRepository<Question, QuestionInput>

export function createLocalQuestionRepository(teacherId: string): QuestionRepository {
  return createOwnedRepository<Question, QuestionInput>({
    collection: createCollection('questions', questionSchema),
    teacherId,
    label: 'Questão',
    archiving: archiveByTimestamp('deletedAt'),
    toEntity: (input, base) => ({ ...base, ...input, createdAt: new Date().toISOString() }),
    searchableFields: (item) => [item.statement, ...item.tags],
    /**
     * Newest first, so a question just written is the first thing on screen.
     * Sorting by statement buried it among hundreds, and finding it again meant
     * remembering how it was worded. Questions from before this was stored sort
     * last, which is where they belong.
     */
    sortKey: (item) => `${item.createdAt ?? ''}|${item.statement}`,
    sortDirection: 'desc',
  })
}
