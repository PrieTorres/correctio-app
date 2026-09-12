import { beforeEach, describe, expect, it } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { createTeacherRepositories } from '@/lib/repositories'
import { clearAllCollections } from '@/lib/storage/collection'
import { renderHookWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import { seedApplicationChain } from '@/test-fixtures'
import {
  useGenerateApplication,
  usePublishAnswerKey,
  useReleaseGrades,
} from '@/features/applications/hooks/useApplications'
import { useReadSheets } from '@/features/grading/hooks/useGrading'
import { usePublicLookup } from '../usePublicLookup'

const repositories = () => createTeacherRepositories(TEST_TEACHER_ID)

const GENERATE = {
  versionCount: 1,
  shuffleQuestions: false,
  shuffleAlternatives: false,
  withStudentIdentification: true,
}

async function printedSheet() {
  const seeded = await seedApplicationChain()
  const { result } = renderHookWithProviders(() => useGenerateApplication())
  await act(() => result.current.mutateAsync({ id: seeded.applicationId, options: GENERATE }))

  const sheets = await repositories().printing.listSheets(seeded.applicationId)
  const versions = await repositories().printing.listVersions(seeded.applicationId)

  return { seeded, sheet: sheets[0]!, versionId: versions[0]!.id }
}

describe('usePublicLookup', () => {
  beforeEach(clearAllCollections)

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
    const { sheet, versionId } = await printedSheet()
    const { result: publish } = renderHookWithProviders(() => usePublishAnswerKey())
    await act(() => publish.current.mutateAsync({ versionId, published: true }))

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

  it('shows the grade once both levels are released and the sheet is corrected', async () => {
    const { seeded, sheet, versionId } = await printedSheet()
    const { result: read } = renderHookWithProviders(() => useReadSheets())
    await act(() =>
      read.current.mutateAsync({ applicationId: seeded.applicationId, sheetIds: [sheet.id] }),
    )

    const { result: actions } = renderHookWithProviders(() => ({
      publish: usePublishAnswerKey(),
      release: useReleaseGrades(),
    }))
    await act(() => actions.current.publish.mutateAsync({ versionId, published: true }))
    await act(() => actions.current.release.mutateAsync({ id: seeded.applicationId, released: true }))

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
    await act(() => actions.current.publish.mutateAsync({ versionId, published: true }))
    await act(() => actions.current.release.mutateAsync({ id: seeded.applicationId, released: true }))

    const { result } = renderHookWithProviders(() => usePublicLookup(sheet.code))

    await waitFor(() => expect(result.current.data?.status).toBe('ANSWER_KEY_ONLY'), {
      timeout: 8000,
    })
  })
})
