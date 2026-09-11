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
    toEntity: (input, base) => ({ ...base, ...input }),
    searchableFields: (item) => [item.statement, ...item.tags],
    sortKey: (item) => item.statement,
  })
}
