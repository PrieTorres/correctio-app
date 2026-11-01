import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { CORRECTION_SOURCE, CORRECTION_STATUS } from '@/types/domain'
import { createTeacherRepositories } from '@/lib/repositories'
import type { SheetImageRepository } from '@/lib/repositories/sheet-image-repository'
import { clearAllCollections } from '@/lib/storage/collection'
import { renderHookWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import { recordReviews, seedApplicationChain } from '@/test-fixtures'
import { useGenerateApplication } from '@/features/applications/hooks/useApplications'
import {
  gradingKeys,
  useAssignStudent,
  useGradingOverview,
  useReadFailures,
  useSaveReview,
  useSheetPhoto,
  useSheetUploads,
  useUnassignedCorrections,
  useUploadedReading,
  useUploadSheetPhoto,
} from '../useGrading'

const repositories = () => createTeacherRepositories(TEST_TEACHER_ID)

const GENERATE = {
  versions: [{ shuffleQuestions: false, shuffleAlternatives: false }],
  withStudentIdentification: true,
}

async function seedGenerated(withStudentIdentification = true) {
  const seeded = await seedApplicationChain()
  const { result } = renderHookWithProviders(() => useGenerateApplication())
  await act(() => result.current.mutateAsync({ id: seeded.applicationId, request: { ...GENERATE, withStudentIdentification } }))
  const sheets = await repositories().printing.listSheets(seeded.applicationId)
  return { ...seeded, sheets }
}

/** A photo store whose answers each test chooses: the real one reads with a canvas, which jsdom does not have. */
function photoStore(overrides: Partial<SheetImageRepository> = {}): SheetImageRepository {
  return {
    upload: vi.fn(),
    photo: vi.fn().mockResolvedValue(new Blob(['photo'], { type: 'image/png' })),
    readFailures: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
}

const withPhotos = (sheetImages: SheetImageRepository) => ({ repositories: { ...repositories(), sheetImages } })

const photo = (name = 'folha.jpg') => new File(['photo'], name, { type: 'image/jpeg' })

describe('gradingKeys', () => {
  it('keeps one application apart from another', () => {
    expect(gradingKeys.ofApplication('a')).not.toEqual(gradingKeys.ofApplication('b'))
    expect(gradingKeys.uploads('a')).not.toEqual(gradingKeys.readFailures('a'))
  })
})

describe('useGradingOverview', () => {
  beforeEach(clearAllCollections)

  it('gathers everything the grading screens need in one read', async () => {
    const seeded = await seedGenerated()
    const { result } = renderHookWithProviders(() => useGradingOverview(seeded.applicationId))

    await waitFor(() => expect(result.current.data).not.toBeUndefined(), { timeout: 8000 })

    expect(result.current.data?.sheets).toHaveLength(2)
    expect(result.current.data?.exam?.id).toBe(seeded.examId)
    expect(result.current.data?.students).toHaveLength(2)
    expect(result.current.data?.bank.map((question) => question.id).sort()).toEqual([seeded.objectiveQuestionId, seeded.discursiveQuestionId].sort())
  })

  /** A question deleted after the exam was applied is still on the paper (#48). */
  it('reads the questions the exam printed, a deleted one included', async () => {
    const seeded = await seedGenerated()
    await repositories().questions.archive(seeded.discursiveQuestionId)
    const { result } = renderHookWithProviders(() => useGradingOverview(seeded.applicationId))

    await waitFor(() => expect(result.current.data).not.toBeUndefined(), { timeout: 8000 })

    expect(result.current.data?.bank.map((question) => question.id)).toContain(seeded.discursiveQuestionId)
  })

  /** The sheets and the report name everyone who sat the exam, a student removed since included (RF09, #161). */
  it('keeps a student removed from the class after the sheets were printed', async () => {
    const seeded = await seedGenerated()
    const [removed] = await repositories().students.listByClass(seeded.classId)
    await repositories().students.remove(seeded.classId, removed?.id ?? '')
    const { result } = renderHookWithProviders(() => useGradingOverview(seeded.applicationId))

    await waitFor(() => expect(result.current.data).not.toBeUndefined(), { timeout: 8000 })

    const names = new Map(result.current.data?.students.map((student) => [student.id, student.fullName]))
    expect(names.get(removed?.id ?? '')).toBe(removed?.fullName)
    expect(result.current.data?.students).toHaveLength(2)
  })

  it('reports nothing for an application that is not there', async () => {
    const { result } = renderHookWithProviders(() => useGradingOverview('nope'))

    await waitFor(() => expect(result.current.data).toBeNull(), { timeout: 8000 })
  })
})

describe('useSaveReview', () => {
  beforeEach(clearAllCollections)

  it('stores the first review of a sheet and answers the grade worked out by the repository', async () => {
    const seeded = await seedGenerated()
    const { result } = renderHookWithProviders(() => useSaveReview())

    const stored = await act(() =>
      result.current.mutateAsync({
        applicationId: seeded.applicationId,
        review: {
          answerSheetId: seeded.sheets[0]?.id ?? '',
          answers: [{ questionId: seeded.objectiveQuestionId, selectedAlternativeId: seeded.correctAlternativeId }],
          discursiveScores: [{ questionId: seeded.discursiveQuestionId, score: 3 }],
          finalize: true,
          imageId: 'photo-1',
        },
      }),
    )

    expect(stored.totalScore).toBe(9)
    expect(stored.status).toBe(CORRECTION_STATUS.DONE)
    expect(stored.source).toBe(CORRECTION_SOURCE.IMAGE_UPLOAD)
  })

  /** The second save edits the same correction: the photo and the sheet stay as they were. */
  it('edits the correction a sheet already has, finishing it once the open-ended score comes', async () => {
    const seeded = await seedGenerated()
    const [open] = await recordReviews(seeded.applicationId, [seeded.sheets[0]?.id ?? ''], { finalize: false })
    const { result } = renderHookWithProviders(() => useSaveReview())

    const finished = await act(() =>
      result.current.mutateAsync({
        applicationId: seeded.applicationId,
        correctionId: open?.id ?? '',
        review: { answerSheetId: open?.answerSheetId ?? '', answers: [], discursiveScores: [{ questionId: seeded.discursiveQuestionId, score: 0 }], finalize: true },
      }),
    )

    expect(finished.id).toBe(open?.id)
    expect(finished.status).toBe(CORRECTION_STATUS.DONE)
    expect(await repositories().corrections.listByApplication(seeded.applicationId)).toHaveLength(1)
  })
})

describe('corrections waiting for their student (P17)', () => {
  beforeEach(clearAllCollections)

  it('lists only the corrections without a student, and drops one once a student is assigned', async () => {
    const seeded = await seedGenerated(false)
    const [first] = await recordReviews(seeded.applicationId, seeded.sheets.map((sheet) => sheet.id))
    const [ana] = await repositories().students.listByClass(seeded.classId)
    const { result } = renderHookWithProviders(() => ({ unassigned: useUnassignedCorrections(seeded.applicationId), assign: useAssignStudent() }))
    await waitFor(() => expect(result.current.unassigned.data).toHaveLength(2), { timeout: 8000 })

    const assigned = await act(() =>
      result.current.assign.mutateAsync({ applicationId: seeded.applicationId, correctionId: first?.id ?? '', studentId: ana?.id ?? '' }),
    )

    expect(assigned.studentId).toBe(ana?.id)
    expect(assigned.isAutomaticallyAssigned).toBe(false)
    await waitFor(() => expect(result.current.unassigned.data).toHaveLength(1), { timeout: 8000 })
  })
})

describe('sending photos (P15)', () => {
  beforeEach(clearAllCollections)

  it('keeps each photo sent, newest first, with its reading', async () => {
    const upload = vi
      .fn()
      .mockResolvedValueOnce({ imageId: 'photo-1', status: 'READ', answerSheetId: 'sheet-1', answers: [] })
      .mockResolvedValueOnce({ imageId: 'photo-2', status: 'QR_NOT_RECOGNIZED' })
    const { result } = renderHookWithProviders(
      () => ({ send: useUploadSheetPhoto('app-1'), uploads: useSheetUploads('app-1'), reading: useUploadedReading('app-1', 'photo-1') }),
      withPhotos(photoStore({ upload })),
    )

    await act(() => result.current.send.mutateAsync(photo('primeira.jpg')))
    await act(() => result.current.send.mutateAsync(photo('segunda.jpg')))

    expect(upload).toHaveBeenCalledWith('app-1', expect.any(File))
    expect(result.current.uploads.map((item) => [item.fileName, item.state])).toEqual([
      ['segunda.jpg', 'success'],
      ['primeira.jpg', 'success'],
    ])
    expect(result.current.uploads[0]?.reading).toEqual({ imageId: 'photo-2', status: 'QR_NOT_RECOGNIZED' })
    expect(result.current.reading).toMatchObject({ imageId: 'photo-1', status: 'READ', answerSheetId: 'sheet-1' })
  })

  it('says why a photo was refused, and the screen goes on', async () => {
    const upload = vi.fn().mockRejectedValue(new Error('Envie a foto em JPG, PNG ou WebP.'))
    const { result } = renderHookWithProviders(
      () => ({ send: useUploadSheetPhoto('app-1'), uploads: useSheetUploads('app-1') }),
      withPhotos(photoStore({ upload })),
    )

    await act(async () => {
      await result.current.send.mutateAsync(photo('notas.txt')).catch(() => undefined)
    })

    await waitFor(() =>
      expect(result.current.uploads).toEqual([expect.objectContaining({ fileName: 'notas.txt', state: 'error', error: 'Envie a foto em JPG, PNG ou WebP.' })]),
    )
  })

  /** What the cache holds is checked against the schema, never taken on trust. */
  it('leaves out a reading that does not match the contract', async () => {
    const upload = vi.fn().mockResolvedValue({ imageId: 'photo-1', status: 'SOMETHING_ELSE' })
    const { result } = renderHookWithProviders(
      () => ({ send: useUploadSheetPhoto('app-1'), uploads: useSheetUploads('app-1'), reading: useUploadedReading('app-1', 'photo-1') }),
      withPhotos(photoStore({ upload })),
    )

    await act(() => result.current.send.mutateAsync(photo()))

    expect(result.current.uploads[0]?.reading).toBeUndefined()
    expect(result.current.reading).toBeUndefined()
  })

  it('reads the failures kept by the server again once a photo is sent', async () => {
    const readFailures = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ imageId: 'photo-1', status: 'QR_NOT_RECOGNIZED', createdAt: '2026-10-30T12:00:00.000Z' }])
    const upload = vi.fn().mockResolvedValue({ imageId: 'photo-1', status: 'QR_NOT_RECOGNIZED' })
    const { result } = renderHookWithProviders(
      () => ({ send: useUploadSheetPhoto('app-1'), failures: useReadFailures('app-1') }),
      withPhotos(photoStore({ upload, readFailures })),
    )
    await waitFor(() => expect(result.current.failures.data).toEqual([]))

    await act(() => result.current.send.mutateAsync(photo()))

    await waitFor(() => expect(result.current.failures.data).toHaveLength(1))
    expect(readFailures).toHaveBeenCalledWith('app-1')
  })
})

describe('useSheetPhoto', () => {
  it('asks for nothing when the correction was typed by hand', () => {
    const store = photoStore()
    const { result } = renderHookWithProviders(() => useSheetPhoto('app-1', undefined), withPhotos(store))

    expect(result.current.fetchStatus).toBe('idle')
    expect(store.photo).not.toHaveBeenCalled()
  })

  it('reads the photo of the review', async () => {
    const store = photoStore()
    const { result } = renderHookWithProviders(() => useSheetPhoto('app-1', 'photo-1'), withPhotos(store))

    await waitFor(() => expect(result.current.data).toBeInstanceOf(Blob))
    expect(store.photo).toHaveBeenCalledWith('app-1', 'photo-1')
  })
})
