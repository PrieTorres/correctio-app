import { z } from 'zod'
import { examSchema, questionSchema, type ExamInput } from '@/lib/schemas'
import { StorageError } from '@/lib/storage/errors'
import type { Exam } from '@/types/domain'
import { UNEXPECTED_RESPONSE, createHttpOwnedRepository, parseEntity } from './create-http-repository'
import type { ApiClient } from './api-client'
import type { ExamRepository } from '../exam-repository'

/** The answer of `POST /exams/draw`; each question is then checked with the bank's own schema. */
const drawResponseSchema = z.object({
  questions: z.array(z.unknown()),
  shortfall: z.object({ multipleChoice: z.number(), openEnded: z.number() }).nullable(),
})

/**
 * The HTTP version of the exam repository, backed by `/exams` (#45). The draw
 * runs on the server, over the teacher's whole bank, and `markReady` calls
 * `PATCH /exams/:id/ready` while the application is still generated in the
 * browser. `markReady` and its route go away with #46, once the application
 * is generated on the server.
 */
export function createHttpExamRepository(api: ApiClient): ExamRepository {
  const base = createHttpOwnedRepository<Exam, ExamInput>({ api, resource: '/exams', schema: examSchema })

  return {
    ...base,

    async markReady(id) {
      await api.request('PATCH', `/exams/${encodeURIComponent(id)}/ready`)
    },

    async draw(request) {
      const parsed = drawResponseSchema.safeParse(await api.request('POST', '/exams/draw', { body: request }))
      if (!parsed.success) throw new StorageError(UNEXPECTED_RESPONSE, 'failure', { cause: parsed.error })
      return {
        questions: parsed.data.questions.map((raw) => parseEntity(questionSchema, raw)),
        shortfall: parsed.data.shortfall,
      }
    },
  }
}
