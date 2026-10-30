import { describe, expect, it, vi } from 'vitest'
import type { AnswerSheet } from '@/types/domain'
import type { ReadingContext } from '@/lib/grading'
import type { ApiClient, FileClient } from '../http/api-client'
import { createHttpSheetImageRepository, createLocalSheetImageRepository } from '../sheet-image-repository'

const SHEET: AnswerSheet = { id: 'sheet-1', applicationId: 'a1', examVersionId: 'v1', sheetNumber: 1, code: 'CODE', answerCardVersion: 1 }
const PRINTED: ReadingContext = { sheets: [SHEET], layouts: {} }
const NOTHING_PRINTED: ReadingContext = { sheets: [], layouts: {} }

const photo = () => new Blob(['photo'], { type: 'image/jpeg' })

function fakeApi(overrides: Partial<ApiClient & FileClient> = {}) {
  return {
    request: vi.fn<ApiClient['request']>(),
    download: vi.fn<FileClient['download']>(),
    upload: vi.fn<FileClient['upload']>(),
    ...overrides,
  }
}

describe('createHttpSheetImageRepository', () => {
  it('sends the photo under its application and answers the reading the API made', async () => {
    const api = fakeApi({ upload: vi.fn().mockResolvedValue({ imageId: 'photo-1', status: 'READ', answerSheetId: 'sheet-1', answers: [] }) })
    const sent = photo()

    const reading = await createHttpSheetImageRepository(api).upload('a 1', sent)

    expect(reading).toEqual({ imageId: 'photo-1', status: 'READ', answerSheetId: 'sheet-1', answers: [] })
    expect(api.upload).toHaveBeenCalledWith('/applications/a%201/sheet-images', sent)
  })

  it('refuses a reading that is not one of the three the contract allows', async () => {
    const api = fakeApi({ upload: vi.fn().mockResolvedValue({ imageId: 'photo-1', status: 'GRADED' }) })

    await expect(createHttpSheetImageRepository(api).upload('a1', photo())).rejects.toThrow()
  })

  /** The photo carries a student's handwriting, so it travels as a file with the token, never as a public address. */
  it('downloads the photo of a review', async () => {
    const blob = photo()
    const api = fakeApi({ download: vi.fn().mockResolvedValue({ blob, filename: 'photo-1.jpg' }) })

    expect(await createHttpSheetImageRepository(api).photo('a1', 'photo 1')).toBe(blob)
    expect(api.download).toHaveBeenCalledWith('/applications/a1/sheet-images/photo%201')
  })

  it('reads the failures the server kept', async () => {
    const failure = { imageId: 'photo-1', status: 'QR_NOT_RECOGNIZED', createdAt: '2026-10-30T12:00:00.000Z' }
    const api = fakeApi({ request: vi.fn().mockResolvedValue([failure]) })

    expect(await createHttpSheetImageRepository(api).readFailures('a1')).toEqual([failure])
    expect(api.request).toHaveBeenCalledWith('GET', '/applications/a1/read-failures')
  })
})

describe('createLocalSheetImageRepository', () => {
  it('reads the photo in this browser and keeps it for the review', async () => {
    const readPhoto = vi.fn().mockResolvedValue({ status: 'READ', answerSheetId: 'sheet-1', answers: [] })
    const repository = createLocalSheetImageRepository({ contextOf: () => Promise.resolve(PRINTED), readPhoto })
    const sent = photo()

    const reading = await repository.upload('a1', sent)

    expect(reading).toMatchObject({ status: 'READ', answerSheetId: 'sheet-1' })
    expect(readPhoto).toHaveBeenCalledWith(sent, PRINTED)
    expect(await repository.photo('a1', reading.imageId)).toBe(sent)
    expect(await repository.readFailures('a1')).toEqual([])
  })

  it('lists a failed reading under its application only, the newest first', async () => {
    const readPhoto = vi
      .fn()
      .mockResolvedValueOnce({ status: 'QR_NOT_RECOGNIZED' })
      .mockResolvedValueOnce({ status: 'READ_FAILED', answerSheetId: 'sheet-1' })
    const repository = createLocalSheetImageRepository({ contextOf: () => Promise.resolve(PRINTED), readPhoto })

    const first = await repository.upload('a1', photo())
    const second = await repository.upload('a1', photo())

    expect((await repository.readFailures('a1')).map((failure) => failure.imageId)).toEqual([second.imageId, first.imageId])
    expect(await repository.readFailures('a2')).toEqual([])
  })

  it('refuses a photo before the paper exists', async () => {
    const repository = createLocalSheetImageRepository({ contextOf: () => Promise.resolve(NOTHING_PRINTED), readPhoto: vi.fn() })

    await expect(repository.upload('a1', photo())).rejects.toMatchObject({ code: 'conflict' })
  })

  it('does not hand a photo to another application', async () => {
    const repository = createLocalSheetImageRepository({
      contextOf: () => Promise.resolve(PRINTED),
      readPhoto: vi.fn().mockResolvedValue({ status: 'QR_NOT_RECOGNIZED' }),
    })
    const { imageId } = await repository.upload('a1', photo())

    await expect(repository.photo('a2', imageId)).rejects.toMatchObject({ code: 'not-found' })
  })
})
