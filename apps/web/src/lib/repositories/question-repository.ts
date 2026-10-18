import type { Question, QuestionType } from '@/types/domain'
import type { QuestionInput } from '@/lib/schemas'
import { questionSchema } from '@/lib/schemas'
import { createCollection } from '@/lib/storage/collection'
import { archiveByTimestamp, createOwnedRepository } from './create-owned-repository'
import type { ListParams, OwnedRepository } from './types'

export type QuestionSort = 'newest' | 'statement'

/**
 * Filters accepted by `QuestionRepository.list`.
 *
 * The names mirror the query string of `GET /questions` so the HTTP adapter
 * (Issue #38) can pass them through without translation.
 */
export interface QuestionListParams extends ListParams {
  type?: QuestionType
  tags?: string[]
  onlyUntagged?: boolean
  sort?: QuestionSort
}

/**
 * Question-specific repository. Adds `tags()`, which lists every tag already
 * in use by the teacher so the filter (P6) and the TagField (P7) can suggest
 * them without pulling the whole bank.
 */
export interface QuestionRepository
  extends OwnedRepository<Question, QuestionInput, QuestionListParams> {
  tags: () => Promise<string[]>
}

export function createLocalQuestionRepository(teacherId: string): QuestionRepository {
  const collection = createCollection('questions', questionSchema)

  const base = createOwnedRepository<Question, QuestionInput, QuestionListParams>({
    collection,
    teacherId,
    label: 'QuestÃ£o',
    archiving: archiveByTimestamp('deletedAt'),
    toEntity: (input, base) => ({ ...base, ...input, createdAt: new Date().toISOString() }),
    searchableFields: (item) => [item.statement, ...item.tags],
    /**
     * The newest question comes first: the teacher most often touches what they
     * just wrote, and scrolling a long bank to find it would be a daily tax.
     */
    sortKey: (item) => `${item.createdAt ?? ''}|${item.statement}`,
    sortDirection: 'desc',
    /**
     * The form sends `null` for fields that the API should clear (for example,
     * turning an objective question into a discursive one). The local schema
     * does not accept `null`, so it is dropped before validation â€” the same
     * effect as `undefined` on this side.
     */
    sanitizeInput: (input) => {
      const clean: Record<string, unknown> = { ...input }
      for (const key of Object.keys(clean)) {
        if (clean[key] === null) clean[key] = undefined
      }
      return clean
    },
    extraFilters: (item, params) => {
      if (params.type !== undefined && item.type !== params.type) return false

      if (params.tags !== undefined && params.tags.length > 0) {
        if (!params.tags.every((tag) => item.tags.includes(tag))) return false
      }

      if (params.onlyUntagged === true && item.tags.length > 0) return false

      return true
    },
    extraSort: (a, b, params) => {
      if (params.sort === 'statement') {
        return a.statement.localeCompare(b.statement, 'pt-BR')
      }
      return 0
    },
  })

  return {
    ...base,
    tags: () => {
      const set = new Set<string>()
      for (const item of collection.readAll()) {
        if (item.teacherId !== teacherId) continue
        if (item.deletedAt !== undefined) continue
        item.tags.forEach((tag) => {
          if (tag.length > 0) set.add(tag)
        })
      }
      return Promise.resolve([...set].sort((a, b) => a.localeCompare(b, 'pt-BR')))
    },
  }
}
