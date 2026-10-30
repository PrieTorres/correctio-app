import { beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { createTeacherRepositories, type ReportRepository } from '@/lib/repositories'
import { clearAllCollections } from '@/lib/storage/collection'
import { renderHookWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import { seedApplicationChain } from '@/test-fixtures'
import { useApplicationReport } from '../useApplicationReport'

function withApplicationReport(application: ReportRepository['application']) {
  const repositories = createTeacherRepositories(TEST_TEACHER_ID)
  return { repositories: { ...repositories, reports: { ...repositories.reports, application } } }
}

describe('useApplicationReport', () => {
  beforeEach(clearAllCollections)

  it('reads the report of the application already calculated', async () => {
    const seeded = await seedApplicationChain()
    const { result } = renderHookWithProviders(() => useApplicationReport(seeded.applicationId))

    await waitFor(() => expect(result.current.data).not.toBeUndefined(), { timeout: 8000 })
    expect(result.current.data).toMatchObject({ applicationId: seeded.applicationId, examTitle: 'Prova de teste', summary: { count: 0 }, students: [] })
  })

  /** A route without an id has nothing to ask for, so nothing leaves for the server. */
  it('asks for nothing without an application', () => {
    const application = vi.fn<ReportRepository['application']>()
    const { result } = renderHookWithProviders(() => useApplicationReport(undefined), withApplicationReport(application))

    expect(result.current.fetchStatus).toBe('idle')
    expect(application).not.toHaveBeenCalled()
  })

  it('surfaces the 404 of an application that is not the teacher’s', async () => {
    const { result } = renderHookWithProviders(() => useApplicationReport('nowhere'))

    await waitFor(() => expect(result.current.error).toMatchObject({ code: 'not-found' }))
  })
})
