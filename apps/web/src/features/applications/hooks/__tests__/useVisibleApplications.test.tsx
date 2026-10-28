import { beforeEach, describe, expect, it } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { createTeacherRepositories } from '@/lib/repositories'
import { clearAllCollections } from '@/lib/storage/collection'
import { renderHookWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import { seedApplicationChain } from '@/test-fixtures'
import { useReadSheets } from '@/features/grading/hooks/useGrading'
import { APPLICATION_FILTER } from '../../application-filter'
import { useGenerateApplication } from '../useApplications'
import { useVisibleApplications } from '../useVisibleApplications'

const GENERATE = {
  versions: [{ shuffleQuestions: false, shuffleAlternatives: false }],
  withStudentIdentification: true,
}

describe('useVisibleApplications', () => {
  beforeEach(clearAllCollections)

  it('lists the active applications by default, corrected or not', async () => {
    const { applicationId } = await seedApplicationChain()

    const { result } = renderHookWithProviders(() => useVisibleApplications(APPLICATION_FILTER.ACTIVE, ''))

    await waitFor(() => expect(result.current.applications.map((item) => item.id)).toEqual([applicationId]), {
      timeout: 8000,
    })
  })

  it('leaves out the applications with no correction in progress', async () => {
    await seedApplicationChain()

    const { result } = renderHookWithProviders(() =>
      useVisibleApplications(APPLICATION_FILTER.IN_PROGRESS, ''),
    )

    await waitFor(() => expect(result.current.isPending).toBe(false), { timeout: 8000 })
    expect(result.current.applications).toEqual([])
  })

  it('keeps the application once one of its sheets was read and still waits for a score', async () => {
    const { applicationId } = await seedApplicationChain()
    const { result: generate } = renderHookWithProviders(() => useGenerateApplication())
    await act(() => generate.current.mutateAsync({ id: applicationId, request: GENERATE }))
    const sheets = await createTeacherRepositories(TEST_TEACHER_ID).printing.listSheets(applicationId)
    const { result: read } = renderHookWithProviders(() => useReadSheets())
    await act(() => read.current.mutateAsync({ applicationId, sheetIds: [sheets[0]?.id ?? ''] }))

    const { result } = renderHookWithProviders(() =>
      useVisibleApplications(APPLICATION_FILTER.IN_PROGRESS, ''),
    )

    await waitFor(() => expect(result.current.applications.map((item) => item.id)).toEqual([applicationId]), {
      timeout: 8000,
    })
  })
})
