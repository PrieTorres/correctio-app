import { describe, expect, it, vi } from 'vitest'
import { classSchema, questionSchema } from '@/lib/schemas'
import { StorageError } from '@/lib/storage/errors'
import type { Class, Question } from '@/types/domain'
import type { ApiClient, HttpMethod, RequestOptions } from '../api-client'
import { createHttpOwnedRepository, toPatchBody } from '../create-http-repository'

const CLASS: Class = {
  id: 'c1',
  teacherId: 'ana',
  name: 'Cálculo I',
  subject: 'Matemática',
  term: '2026/2',
  status: 'active',
  inviteCode: 'ABC12345',
}

type Answer = (method: HttpMethod, path: string, options?: RequestOptions) => Promise<unknown>

function fakeApi(answer: Answer) {
  const request = vi.fn<ApiClient['request']>(answer)
  return { api: { request }, request }
}

function classRepository(answer: Answer) {
  const { api, request } = fakeApi(answer)
  return { repository: createHttpOwnedRepository<Class, Partial<Class>>({ api, resource: '/classes', schema: classSchema }), request }
}

describe('createHttpOwnedRepository', () => {
  it('lists through the query string and validates every item', async () => {
    const { repository, request } = classRepository(() => Promise.resolve({ items: [CLASS], total: 1 }))

    await expect(repository.list({ search: '', archived: true, page: 2, pageSize: 10 })).resolves.toEqual({
      items: [CLASS],
      total: 1,
    })
    expect(request).toHaveBeenCalledWith('GET', '/classes', {
      query: { search: undefined, archived: true, page: 2, pageSize: 10 },
    })
  })

  it('answers null for a record the API does not find, so detail screens show "not found"', async () => {
    const { repository } = classRepository(() => Promise.reject(new StorageError('Turma não encontrada.', 'not-found')))

    await expect(repository.getById('elsewhere')).resolves.toBeNull()
  })

  it('still throws any other error on a read', async () => {
    const { repository } = classRepository(() => Promise.reject(new StorageError('Falhou.', 'failure')))

    await expect(repository.getById('c1')).rejects.toMatchObject({ code: 'failure' })
  })

  it('keeps fields the schema does not know', async () => {
    const { repository } = classRepository(() => Promise.resolve({ ...CLASS, studentCount: 32 }))

    await expect(repository.getById('c1')).resolves.toMatchObject({ studentCount: 32 })
  })

  it('refuses a response out of shape instead of dropping it silently', async () => {
    const { repository } = classRepository(() => Promise.resolve({ items: [{ ...CLASS, status: 'gone' }], total: 1 }))

    await expect(repository.list()).rejects.toMatchObject({ code: 'failure' })
  })

  it('never sends the owner when creating', async () => {
    const { repository, request } = classRepository(() => Promise.resolve(CLASS))
    await repository.create({ name: 'Cálculo I', subject: 'Matemática', term: '2026/2', teacherId: 'someone-else' })

    expect(request).toHaveBeenCalledWith('POST', '/classes', {
      body: { name: 'Cálculo I', subject: 'Matemática', term: '2026/2' },
    })
  })

  it('patches only the fields it was given', async () => {
    const { repository, request } = classRepository(() => Promise.resolve({ ...CLASS, name: 'Cálculo II' }))
    await repository.update('c1', { name: 'Cálculo II' })

    expect(request).toHaveBeenCalledWith('PATCH', '/classes/c1', { body: { name: 'Cálculo II' } })
  })

  it('archives and restores through the routes of the Spec', async () => {
    const { repository, request } = classRepository(() => Promise.resolve(undefined))
    await repository.archive('c1')
    await repository.restore('c1')

    expect(request).toHaveBeenNthCalledWith(1, 'PATCH', '/classes/c1/archive')
    expect(request).toHaveBeenNthCalledWith(2, 'PATCH', '/classes/c1/restore')
  })
})

describe('a question over HTTP', () => {
  const DISCURSIVE = {
    id: 'q1',
    teacherId: 'ana',
    type: 'discursiva',
    statement: 'Explique.',
    tags: [],
    maxScore: 2,
    allowShuffleAlternatives: false,
  }

  it('archives with DELETE, as the Spec does for questions', async () => {
    const { api, request } = fakeApi(() => Promise.resolve(undefined))
    const repository = createHttpOwnedRepository<Question, object>({
      api,
      resource: '/questions',
      schema: questionSchema,
      archiveRoute: 'delete',
    })
    await repository.archive('q1')

    expect(request).toHaveBeenCalledWith('DELETE', '/questions/q1')
  })

  it('reads a field the API sends as null as absent, the shape of the contract', async () => {
    const { api } = fakeApi(() =>
      Promise.resolve({ ...DISCURSIVE, alternatives: null, correctAlternativeId: null, deletedAt: null }),
    )
    const repository = createHttpOwnedRepository<Question, object>({ api, resource: '/questions', schema: questionSchema })
    const question = await repository.getById('q1')

    expect(question).not.toHaveProperty('alternatives')
    expect(question?.deletedAt).toBeUndefined()
  })
})

describe('toPatchBody', () => {
  it('sends a cleared field as null, because JSON drops undefined', () => {
    expect(toPatchBody({ maxScore: undefined, statement: 'Novo' })).toEqual({ maxScore: null, statement: 'Novo' })
  })

  it('never carries the owner or the id', () => {
    expect(toPatchBody({ id: 'q1', teacherId: 'ana', statement: 'Novo' })).toEqual({ statement: 'Novo' })
  })
})
