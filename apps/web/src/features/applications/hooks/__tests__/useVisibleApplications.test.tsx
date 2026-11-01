import { beforeEach, describe, expect, it } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { createTeacherRepositories } from '@/lib/repositories'
import { clearAllCollections } from '@/lib/storage/collection'
import { renderHookWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import { recordReviews, seedApplicationChain } from '@/test-fixtures'
import { APPLICATION_FILTER, type ApplicationFilter } from '../../application-filter'
import { NO_APPLICATION_LIST_FILTERS } from '../../list-filters'
import { useGenerateApplication } from '../useApplications'
import { useVisibleApplications } from '../useVisibleApplications'

const GENERATE = {
  versions: [{ shuffleQuestions: false, shuffleAlternatives: false }],
  withStudentIdentification: true,
}

/** The first page of a situation, with no other filter and no search. */
const showing = (filter: ApplicationFilter) => ({ filter, filters: NO_APPLICATION_LIST_FILTERS, search: '', page: 1 })

describe('useVisibleApplications', () => {
  beforeEach(clearAllCollections)

  it('lists the active applications by default, corrected or not', async () => {
    const { applicationId } = await seedApplicationChain()

    const { result } = renderHookWithProviders(() => useVisibleApplications(showing(APPLICATION_FILTER.ACTIVE)))

    await waitFor(() => expect(result.current.applications.map((item) => item.id)).toEqual([applicationId]), {
      timeout: 8000,
    })
  })

  it('counts every application of the situation, for the pagination', async () => {
    const { examId, classId } = await seedApplicationChain()
    await createTeacherRepositories(TEST_TEACHER_ID).applications.create({ examId, classId, date: '2026-10-12T12:00:00.000Z' })

    const { result } = renderHookWithProviders(() => useVisibleApplications(showing(APPLICATION_FILTER.ACTIVE)))

    await waitFor(() => expect(result.current.total).toBe(2), { timeout: 8000 })
    expect(result.current.applications).toHaveLength(2)
  })

  it('leaves out the applications with no correction in progress', async () => {
    await seedApplicationChain()

    const { result } = renderHookWithProviders(() =>
      useVisibleApplications(showing(APPLICATION_FILTER.IN_PROGRESS)),
    )

    await waitFor(() => expect(result.current.isPending).toBe(false), { timeout: 8000 })
    expect(result.current.applications).toEqual([])
  })

  it('keeps the application once one of its sheets was read and still waits for a score', async () => {
    const { applicationId } = await seedApplicationChain()
    const { result: generate } = renderHookWithProviders(() => useGenerateApplication())
    await act(() => generate.current.mutateAsync({ id: applicationId, request: GENERATE }))
    const sheets = await createTeacherRepositories(TEST_TEACHER_ID).printing.listSheets(applicationId)
    await recordReviews(applicationId, [sheets[0]?.id ?? ''])

    const { result } = renderHookWithProviders(() =>
      useVisibleApplications(showing(APPLICATION_FILTER.IN_PROGRESS)),
    )

    await waitFor(() => expect(result.current.applications.map((item) => item.id)).toEqual([applicationId]), {
      timeout: 8000,
    })
    expect(result.current.total).toBe(1)
  })

  /** The class, exam and paper filters still apply on top of the corrections in progress. */
  it('keeps the other filters on while showing the corrections in progress', async () => {
    const { applicationId, classId } = await seedApplicationChain()
    const { result: generate } = renderHookWithProviders(() => useGenerateApplication())
    await act(() => generate.current.mutateAsync({ id: applicationId, request: GENERATE }))
    const sheets = await createTeacherRepositories(TEST_TEACHER_ID).printing.listSheets(applicationId)
    await recordReviews(applicationId, [sheets[0]?.id ?? ''])

    const inProgressOf = (class_: string) => ({
      ...showing(APPLICATION_FILTER.IN_PROGRESS),
      filters: { ...NO_APPLICATION_LIST_FILTERS, classId: class_ },
    })
    const { result: same } = renderHookWithProviders(() => useVisibleApplications(inProgressOf(classId)))
    const { result: other } = renderHookWithProviders(() => useVisibleApplications(inProgressOf('another-class')))

    await waitFor(() => expect(same.current.applications.map((item) => item.id)).toEqual([applicationId]), { timeout: 8000 })
    await waitFor(() => expect(other.current.isPending).toBe(false), { timeout: 8000 })
    expect(other.current.applications).toEqual([])
    expect(other.current.total).toBe(0)
  })
})
