import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAllCollections } from '@/lib/storage/collection'
import { StorageError } from '@/lib/storage/errors'
import { createTeacherRepositories } from '..'
import type { ApiClient } from '../http/api-client'
import { createHttpPublicLookupRepository, createPublicLookupRepository } from '../public-lookup-repository'

const HEADER = {
  examTitle: 'Prova 1',
  subject: 'Matemática',
  className: 'Cálculo I',
  date: '2026-10-20T13:00:00.000Z',
  identity: { type: 'SHEET', sheetNumber: 3, versionNumber: 1 },
}

function clientAnswering(body: unknown): { api: ApiClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue(body)
  return { api: { request }, request }
}

describe('createHttpPublicLookupRepository', () => {
  it('asks for the code on the public route, encoded', async () => {
    const { api, request } = clientAnswering({ status: 'INVALID_CODE' })

    await createHttpPublicLookupRepository(api).findByCode('a/b?c')

    expect(request).toHaveBeenCalledWith('GET', '/public/sheets/a%2Fb%3Fc')
  })

  it('returns an invalid code as a result, not as an error', async () => {
    const { api } = clientAnswering({ status: 'INVALID_CODE' })

    await expect(createHttpPublicLookupRepository(api).findByCode('X')).resolves.toEqual({ status: 'INVALID_CODE' })
  })

  it('keeps the score and the results of the released state', async () => {
    const body = {
      status: 'ANSWER_KEY_AND_SCORE',
      header: HEADER,
      answerKey: [{ questionId: 'q1', correctAlternativeId: 'a1' }],
      totalScore: 7.5,
      objectiveResults: [{ questionId: 'q1', correct: true, score: 2.5, selectedAlternativeId: 'a1' }],
    }
    const { api } = clientAnswering(body)

    await expect(createHttpPublicLookupRepository(api).findByCode('X')).resolves.toEqual(body)
  })

  /** A field the server added by mistake must not get as far as the screen. */
  it('drops a field the contract does not declare', async () => {
    const { api } = clientAnswering({ status: 'NOTHING_RELEASED', header: HEADER, registration: '2026001' })

    const result = await createHttpPublicLookupRepository(api).findByCode('X')

    expect(JSON.stringify(result)).not.toContain('2026001')
  })

  it('refuses a score in a state that has no answer key', async () => {
    const { api } = clientAnswering({ status: 'ANSWER_KEY_AND_SCORE', header: HEADER, totalScore: 9 })

    await expect(createHttpPublicLookupRepository(api).findByCode('X')).rejects.toBeInstanceOf(StorageError)
  })

  it('refuses an answer in a shape nobody agreed on', async () => {
    const { api } = clientAnswering({ status: 'SOMETHING_ELSE' })

    await expect(createHttpPublicLookupRepository(api).findByCode('X')).rejects.toMatchObject({ code: 'failure' })
  })

  it('lets a 429 through with its own code', async () => {
    const request = vi.fn().mockRejectedValue(new StorageError('Espere.', 'rate-limited'))

    await expect(createHttpPublicLookupRepository({ request }).findByCode('X')).rejects.toMatchObject({ code: 'rate-limited' })
  })
})

describe('createPublicLookupRepository', () => {
  beforeEach(clearAllCollections)

  /** The sheets are generated on the server since #46, so with a client the page reads them there. */
  it('reads the public route of the API when there is a client, with no session to wait for', async () => {
    const { api, request } = clientAnswering({ status: 'INVALID_CODE' })
    const lookup = createPublicLookupRepository(createTeacherRepositories('ana'), api)

    await lookup.findByCode('X')

    expect(request).toHaveBeenCalledWith('GET', '/public/sheets/X')
    expect(lookup.readsThisBrowser).toBeUndefined()
  })

  it('reads the sheets printed in this browser without a client, and says so', async () => {
    const lookup = createPublicLookupRepository(createTeacherRepositories('ana'))

    await expect(lookup.findByCode('X')).resolves.toEqual({ status: 'INVALID_CODE' })
    expect(lookup.readsThisBrowser).toBe(true)
  })
})
