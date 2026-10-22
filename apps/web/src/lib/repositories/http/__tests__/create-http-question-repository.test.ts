import { describe, expect, it, vi } from 'vitest'
import type { ApiClient, HttpMethod, RequestOptions } from '../api-client'
import { createHttpQuestionRepository } from '../create-http-question-repository'

type Answer = (method: HttpMethod, path: string, options?: RequestOptions) => Promise<unknown>

function fakeApi(answer: Answer) {
  const request = vi.fn<ApiClient['request']>(answer)
  return { api: { request }, request }
}

const QUESTION = {
  id: 'q1',
  teacherId: 'ana',
  type: 'objetiva',
  statement: 'What is 2 + 2?',
  tags: ['math'],
  alternatives: [
    { id: 'a1', text: '3' },
    { id: 'a2', text: '4' },
  ],
  correctAlternativeId: 'a2',
  maxScore: 1,
  allowShuffleAlternatives: true,
  createdAt: '2026-10-18T12:00:00.000Z',
  updatedAt: '2026-10-18T12:00:00.000Z',
}

describe('createHttpQuestionRepository', () => {
  it('lists questions with the server-side filters in the query string', async () => {
    const { api, request } = fakeApi(() => Promise.resolve({ items: [QUESTION], total: 1 }))
    const repository = createHttpQuestionRepository(api)

    await repository.list({
      type: 'objetiva',
      tags: ['math', 'algebra'],
      onlyUntagged: false,
      sort: 'newest',
      page: 2,
      pageSize: 10,
    })

    expect(request).toHaveBeenCalledWith('GET', '/questions', {
      query: {
        search: undefined,
        archived: undefined,
        page: 2,
        pageSize: 10,
        type: 'objetiva',
        tags: ['math', 'algebra'],
        onlyUntagged: false,
        sort: 'newest',
      },
    })
  })

  it('omits filters that were not set', async () => {
    const { api, request } = fakeApi(() => Promise.resolve({ items: [], total: 0 }))
    const repository = createHttpQuestionRepository(api)

    await repository.list({})

    expect(request).toHaveBeenCalledWith('GET', '/questions', {
      query: {
        search: undefined,
        archived: undefined,
        page: undefined,
        pageSize: undefined,
        type: undefined,
        tags: undefined,
        onlyUntagged: undefined,
        sort: undefined,
      },
    })
  })

  it('reads the distinct tags in use', async () => {
    const { api, request } = fakeApi(() => Promise.resolve({ tags: ['algebra', 'geometry'] }))
    const repository = createHttpQuestionRepository(api)

    await expect(repository.tags()).resolves.toEqual(['algebra', 'geometry'])
    expect(request).toHaveBeenCalledWith('GET', '/questions/tags')
  })

  it('refuses a tags response out of shape instead of returning an empty list', async () => {
    const { api } = fakeApi(() => Promise.resolve({ tags: 'not-an-array' }))
    const repository = createHttpQuestionRepository(api)

    await expect(repository.tags()).rejects.toMatchObject({
      code: 'failure',
      message: 'O servidor respondeu num formato inesperado. Tente de novo em instantes.',
    })
  })
})