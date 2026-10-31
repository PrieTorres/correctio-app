import { describe, expect, it, vi } from 'vitest'
import { CORRECTION_SOURCE, CORRECTION_STATUS } from '@/types/domain'
import type { ApiClient, HttpMethod, RequestOptions } from '../api-client'
import { createHttpCorrectionRepository } from '../create-http-correction-repository'
import { LARGEST_PAGE } from '../../read-every-page'

type Answer = (method: HttpMethod, path: string, options?: RequestOptions) => Promise<unknown>

function fakeApi(answer: Answer) {
  const request = vi.fn<ApiClient['request']>(answer)
  return { api: { request }, request }
}

const graded = {
  id: 'c-1',
  examVersionId: 'v-1',
  answerSheetId: 'sheet-1',
  status: CORRECTION_STATUS.DONE,
  source: CORRECTION_SOURCE.IMAGE_UPLOAD,
  objectiveResults: [],
  discursiveScores: [],
  totalScore: 8,
  confirmedAt: '2026-10-30T12:00:00.000Z',
  correctedBy: 'ana',
  isAutomaticallyAssigned: true,
  clientCorrectionId: 'client-1',
  syncStatus: 'synced',
  imageUrl: 'answer-sheets/a1/photo-1.jpg',
}

describe('createHttpCorrectionRepository', () => {
  it('reads the corrections under their application, every page, with the filter the API reads', async () => {
    const { api, request } = fakeApi(() => Promise.resolve({ items: [graded], total: 1 }))

    const listed = await createHttpCorrectionRepository(api).listByApplication('a 1', { assigned: false })

    expect(listed).toEqual([graded])
    expect(request).toHaveBeenCalledWith('GET', '/applications/a%201/corrections', { query: { page: 1, pageSize: LARGEST_PAGE, assigned: false } })
  })

  /** The review goes in and the graded correction comes back: no grade is ever sent from the screen. */
  it('sends the review and answers the correction the server graded', async () => {
    const { api, request } = fakeApi(() => Promise.resolve(graded))
    const review = { answerSheetId: 'sheet-1', answers: [], discursiveScores: [], finalize: true, imageId: 'photo-1' }

    const stored = await createHttpCorrectionRepository(api).create('a1', review)

    expect(stored.totalScore).toBe(8)
    expect(request).toHaveBeenCalledWith('POST', '/applications/a1/corrections', { body: review })
  })

  it('sends only what changed when a correction is edited', async () => {
    const { api, request } = fakeApi(() => Promise.resolve({ ...graded, studentId: 's-1', isAutomaticallyAssigned: false }))

    const stored = await createHttpCorrectionRepository(api).update('a1', 'c 1', { studentId: 's-1' })

    expect(stored.studentId).toBe('s-1')
    expect(request).toHaveBeenCalledWith('PATCH', '/applications/a1/corrections/c%201', { body: { studentId: 's-1' } })
  })

  it('refuses an answer that is not a correction', async () => {
    const { api } = fakeApi(() => Promise.resolve({ id: 'c-1' }))

    await expect(createHttpCorrectionRepository(api).create('a1', { answerSheetId: 's', answers: [], discursiveScores: [], finalize: false })).rejects.toThrow()
  })
})
