import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { CORRECTION_STATUS } from '@/types/domain'
import { StorageError } from '@/lib/storage/errors'
import { createLocalAuthProvider } from '@/lib/auth'
import { createTeacherRepositories } from '@/lib/repositories'
import { clearAllCollections } from '@/lib/storage/collection'
import { renderHookWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import { recordReviews, seedApplicationChain } from '@/test-fixtures'
import {
  useGenerateApplication,
  usePublishAnswerKey,
  useReleaseGrades,
} from '@/features/applications/hooks/useApplications'
import { usePublicLookup } from '../usePublicLookup'

const repositories = () => createTeacherRepositories(TEST_TEACHER_ID)

const GENERATE = {
  versions: [{ shuffleQuestions: false, shuffleAlternatives: false }],
  withStudentIdentification: true,
}

async function printedSheet() {
  const seeded = await seedApplicationChain()
  const { result } = renderHookWithProviders(() => useGenerateApplication())
  await act(() => result.current.mutateAsync({ id: seeded.applicationId, request: GENERATE }))

  const sheets = await repositories().printing.listSheets(seeded.applicationId)
  const versions = await repositories().printing.listVersions(seeded.applicationId)

  return { seeded, sheet: sheets[0]!, versionId: versions[0]!.id }
}

/** A session check that never finishes, as on a slow network, to see what the lookup waits for. */
const restoringForever = { ...createLocalAuthProvider(), restoreSession: () => new Promise<never>(() => {}) }

describe('usePublicLookup', () => {
  beforeEach(clearAllCollections)

  /** A student has no session, and the API needs none: the code is the whole credential. */
  it('asks the API at once, without waiting for a session', async () => {
    const findByCode = vi.fn().mockResolvedValue({ status: 'INVALID_CODE' })

    const { result } = renderHookWithProviders(() => usePublicLookup('ABC'), {
      auth: restoringForever,
      publicLookup: { findByCode },
    })

    await waitFor(() => expect(result.current.data?.status).toBe('INVALID_CODE'))
    expect(findByCode).toHaveBeenCalledWith('ABC')
  })

  /** In the demo the sheets belong to whoever is signed in here, so asking first would search nobody's. */
  it('waits for the session before reading this browser', async () => {
    const findByCode = vi.fn().mockResolvedValue({ status: 'INVALID_CODE' })

    renderHookWithProviders(() => usePublicLookup('ABC'), {
      auth: restoringForever,
      publicLookup: { findByCode, readsThisBrowser: true },
    })

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(findByCode).not.toHaveBeenCalled()
  })

  it('reports an invalid code for something nobody printed', async () => {
    const { result } = renderHookWithProviders(() => usePublicLookup('NAOEXISTE'))

    await waitFor(() => expect(result.current.data?.status).toBe('INVALID_CODE'), {
      timeout: 8000,
    })
  })

  it('shows nothing released before the teacher publishes anything', async () => {
    const { sheet } = await printedSheet()
    const { result } = renderHookWithProviders(() => usePublicLookup(sheet.code))

    await waitFor(() => expect(result.current.data?.status).toBe('NOTHING_RELEASED'), {
      timeout: 8000,
    })
  })

  it('names the student on a paper printed with identification', async () => {
    const { sheet } = await printedSheet()
    const { result } = renderHookWithProviders(() => usePublicLookup(sheet.code))

    await waitFor(() => expect(result.current.data).not.toBeUndefined(), { timeout: 8000 })

    const lookup = result.current.data
    if (lookup !== undefined && lookup.status !== 'INVALID_CODE') {
      expect(lookup.header.identity.type).toBe('STUDENT')
      expect(lookup.header.examTitle).toBe('Prova de teste')
    }
  })

  it('shows the answer key once it is published, and still no grade', async () => {
    const { seeded, sheet, versionId } = await printedSheet()
    const { result: publish } = renderHookWithProviders(() => usePublishAnswerKey())
    await act(() => publish.current.mutateAsync({ applicationId: seeded.applicationId, versionId, published: true }))

    const { result } = renderHookWithProviders(() => usePublicLookup(sheet.code))

    await waitFor(() => expect(result.current.data?.status).toBe('ANSWER_KEY_ONLY'), {
      timeout: 8000,
    })
  })

  /** The two levels nest: a grade never appears without the key. */
  it('keeps everything hidden when grades are released but the key is not', async () => {
    const { seeded, sheet } = await printedSheet()
    const { result: release } = renderHookWithProviders(() => useReleaseGrades())
    await act(() => release.current.mutateAsync({ id: seeded.applicationId, released: true }))

    const { result } = renderHookWithProviders(() => usePublicLookup(sheet.code))

    await waitFor(() => expect(result.current.data?.status).toBe('NOTHING_RELEASED'), {
      timeout: 8000,
    })
  })

  async function releasedAndRead() {
    const { seeded, sheet, versionId } = await printedSheet()
    const [correction] = await recordReviews(seeded.applicationId, [sheet.id])

    const { result: actions } = renderHookWithProviders(() => ({
      publish: usePublishAnswerKey(),
      release: useReleaseGrades(),
    }))
    await act(() => actions.current.publish.mutateAsync({ applicationId: seeded.applicationId, versionId, published: true }))
    await act(() => actions.current.release.mutateAsync({ id: seeded.applicationId, released: true }))

    return { seeded, sheet, correction: correction! }
  }

  /** The seeded exam has an open-ended question with no score yet, so the correction stays open. */
  it('withholds the grade while the correction is still in progress', async () => {
    const { sheet, correction } = await releasedAndRead()
    expect(correction.status).toBe(CORRECTION_STATUS.IN_PROGRESS)

    const { result } = renderHookWithProviders(() => usePublicLookup(sheet.code))

    await waitFor(() => expect(result.current.data?.status).toBe('ANSWER_KEY_ONLY'), {
      timeout: 8000,
    })
  })

  it('shows the grade once both levels are released and the teacher confirmed the correction', async () => {
    const { seeded, sheet, correction } = await releasedAndRead()
    const finished = await repositories().corrections.update(seeded.applicationId, correction.id, {
      discursiveScores: [{ questionId: seeded.discursiveQuestionId, score: 0 }],
      finalize: true,
    })
    expect(finished.status).toBe(CORRECTION_STATUS.DONE)

    const { result } = renderHookWithProviders(() => usePublicLookup(sheet.code))

    await waitFor(() => expect(result.current.data?.status).toBe('ANSWER_KEY_AND_SCORE'), {
      timeout: 8000,
    })
  })

  it('withholds the grade of a sheet nobody has corrected', async () => {
    const { seeded, sheet, versionId } = await printedSheet()
    const { result: actions } = renderHookWithProviders(() => ({
      publish: usePublishAnswerKey(),
      release: useReleaseGrades(),
    }))
    await act(() => actions.current.publish.mutateAsync({ applicationId: seeded.applicationId, versionId, published: true }))
    await act(() => actions.current.release.mutateAsync({ id: seeded.applicationId, released: true }))

    const { result } = renderHookWithProviders(() => usePublicLookup(sheet.code))

    await waitFor(() => expect(result.current.data?.status).toBe('ANSWER_KEY_ONLY'), {
      timeout: 8000,
    })
  })
})

describe('usePublicLookup through the public repository', () => {
  it('asks only the public repository, never the teacher ones', async () => {
    const findByCode = vi.fn().mockResolvedValue({ status: 'INVALID_CODE' })
    const { result } = renderHookWithProviders(() => usePublicLookup('ABC'), { publicLookup: { findByCode } })

    await waitFor(() => expect(result.current.data?.status).toBe('INVALID_CODE'), { timeout: 8000 })
    expect(findByCode).toHaveBeenCalledExactlyOnceWith('ABC')
  })

  it('does not retry a refusal', async () => {
    const findByCode = vi.fn().mockRejectedValue(new StorageError('Espere.', 'rate-limited'))
    const { result } = renderHookWithProviders(() => usePublicLookup('ABC'), { publicLookup: { findByCode } })

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 8000 })
    expect(findByCode).toHaveBeenCalledTimes(1)
  })
})
