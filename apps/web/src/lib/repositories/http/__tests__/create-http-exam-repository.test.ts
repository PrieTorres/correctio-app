import { describe, expect, it, vi } from 'vitest'
import { StorageError } from '@/lib/storage/errors'
import type { ApiClient, HttpMethod, RequestOptions } from '../api-client'
import { createHttpExamRepository } from '../create-http-exam-repository'

type Answer = (method: HttpMethod, path: string, options?: RequestOptions) => Promise<unknown>

function fakeApi(answer: Answer) {
  const request = vi.fn<ApiClient['request']>(answer)
  return { api: { request }, request }
}

const QUESTION = {
  id: 'q1',
  teacherId: 'ana',
  type: 'discursiva',
  statement: 'Explique continuidade.',
  tags: ['Limites'],
  maxScore: 2,
  allowShuffleAlternatives: true,
  deletedAt: null,
}

const EXAM = {
  id: 'e1',
  teacherId: 'ana',
  title: 'Cálculo I — Prova 1',
  description: '',
  questions: [{ questionId: 'q1', order: 0, score: 2, allowShuffleAlternatives: true }],
  status: 'draft',
  defaultShuffleQuestions: true,
  defaultShuffleAlternatives: false,
}

describe('createHttpExamRepository', () => {
  it('reads an exam from /exams/:id, with its questions', async () => {
    const { api, request } = fakeApi(() => Promise.resolve(EXAM))

    const exam = await createHttpExamRepository(api).getById('e1')

    expect(request).toHaveBeenCalledWith('GET', '/exams/e1')
    expect(exam?.questions).toEqual(EXAM.questions)
    expect(exam?.status).toBe('draft')
  })

  it('archives and restores through the archive routes', async () => {
    const { api, request } = fakeApi(() => Promise.resolve(undefined))
    const repository = createHttpExamRepository(api)

    await repository.archive('e1')
    await repository.restore('e1')

    expect(request).toHaveBeenNthCalledWith(1, 'PATCH', '/exams/e1/archive')
    expect(request).toHaveBeenNthCalledWith(2, 'PATCH', '/exams/e1/restore')
  })

  /** While the application is generated in the browser, the screen tells the server the exam was applied. */
  it('marks an exam as ready through PATCH /exams/:id/ready', async () => {
    const { api, request } = fakeApi(() => Promise.resolve(undefined))

    await createHttpExamRepository(api).markReady('e 1')

    expect(request).toHaveBeenCalledWith('PATCH', '/exams/e%201/ready')
  })

  it('draws on the server and checks each question with the bank schema', async () => {
    const { api, request } = fakeApi(() => Promise.resolve({ questions: [QUESTION], shortfall: { multipleChoice: 2, openEnded: 0 } }))
    const body = { tags: ['Limites'], multipleChoiceCount: 2, openEndedCount: 1, excludeIds: ['q9'] }

    const result = await createHttpExamRepository(api).draw(body)

    expect(request).toHaveBeenCalledWith('POST', '/exams/draw', { body })
    expect(result.questions[0]?.statement).toBe('Explique continuidade.')
    expect(result.questions[0]).not.toHaveProperty('deletedAt')
    expect(result.shortfall).toEqual({ multipleChoice: 2, openEnded: 0 })
  })

  it('fails loudly when the draw answers in another shape', async () => {
    const { api } = fakeApi(() => Promise.resolve({ items: [] }))

    await expect(createHttpExamRepository(api).draw({ tags: [], multipleChoiceCount: 1, openEndedCount: 0, excludeIds: [] })).rejects.toBeInstanceOf(StorageError)
  })
})
