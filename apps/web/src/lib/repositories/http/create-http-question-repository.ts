import { z } from 'zod'
import { StorageError } from '@/lib/storage/errors'
import { questionSchema, type QuestionInput } from '@/lib/schemas'
import type { Question } from '@/types/domain'
import { UNEXPECTED_RESPONSE, createHttpOwnedRepository } from './create-http-repository'
import type { ApiClient } from './api-client'
import type { QuestionListParams, QuestionRepository } from '../question-repository'

const tagsResponseSchema = z.object({ tags: z.array(z.string()) })

/**
 * The query `GET /questions` reads. Every key carries the same name the server
 * uses — `type`, `tags`, `anyTag`, `onlyUntagged`, `sort` — so what the screen picked
 * travels straight into the URL with no translation in between.
 */
function questionFilters(params: QuestionListParams) {
  return {
    type: params.type,
    tags: params.tags,
    anyTag: params.anyTag,
    onlyUntagged: params.onlyUntagged,
    sort: params.sort,
  }
}

/**
 * The HTTP version of the question bank repository, backed by the endpoints
 * `/questions`, `/questions/:id` and `/questions/tags`. Archiving goes through
 * `DELETE /questions/:id`, as the Spec's endpoint table defines; the server
 * turns it into a soft delete and `restore` clears the mark.
 *
 * `tags()` reads the endpoint's answer shape (`{ tags: string[] }`) and
 * validates it, so a response that drifts from the contract fails loudly
 * instead of silently returning an empty list.
 */
export function createHttpQuestionRepository(api: ApiClient): QuestionRepository {
  const base = createHttpOwnedRepository<Question, QuestionInput, QuestionListParams>({
    api,
    resource: '/questions',
    schema: questionSchema,
    archiveRoute: 'delete',
    extraQuery: questionFilters,
  })

  return {
    ...base,
    async tags() {
      const raw = await api.request('GET', '/questions/tags')
      const parsed = tagsResponseSchema.safeParse(raw)
      if (!parsed.success) {
        throw new StorageError(UNEXPECTED_RESPONSE, 'failure', { cause: parsed.error })
      }
      return parsed.data.tags
    },
  }
}