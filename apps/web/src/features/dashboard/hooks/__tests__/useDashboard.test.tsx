import { beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { clearAllCollections } from '@/lib/storage/collection'
import { createTeacherRepositories, type ReportRepository } from '@/lib/repositories'
import type { DashboardSummary } from '@/lib/reports'
import { renderHookWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import { seedApplicationChain } from '@/test-fixtures'
import { useDashboardSummary } from '../useDashboard'

const SUMMARY: DashboardSummary = {
  classes: 2,
  questions: 12,
  exams: 3,
  applications: 4,
  pendingCorrections: 5,
  recent: [{ id: 'a1', title: 'Cálculo I', detail: 'Turma A', date: '2026-10-05T12:00:00.000Z' }],
  gradable: [],
  students: 30,
  open: [],
}

/** The teacher's repositories with the reports answered by `dashboard`, the one request the panel makes. */
function withDashboard(dashboard: ReportRepository['dashboard']) {
  const repositories = createTeacherRepositories(TEST_TEACHER_ID)
  return { repositories: { ...repositories, reports: { ...repositories.reports, dashboard } } }
}

describe('useDashboardSummary', () => {
  beforeEach(clearAllCollections)

  /** One request, calculated by the repository (on the API since #50), instead of four lists of 1000. */
  it('reads the summary in a single request to the reports', async () => {
    const dashboard = vi.fn(() => Promise.resolve(SUMMARY))
    const { result } = renderHookWithProviders(() => useDashboardSummary(), withDashboard(dashboard))

    await waitFor(() => expect(result.current.data).toEqual(SUMMARY))
    expect(dashboard).toHaveBeenCalledTimes(1)
  })

  it('counts nothing in a system with nothing in it', async () => {
    const { result } = renderHookWithProviders(() => useDashboardSummary())

    await waitFor(() => expect(result.current.data).not.toBeUndefined())

    expect(result.current.data).toMatchObject({ classes: 0, questions: 0, exams: 0, applications: 0, pendingCorrections: 0, recent: [], students: 0, open: [] })
    expect(result.current.data).not.toHaveProperty('classWithoutStudents')
  })

  it('counts what the teacher has created, in the demo too', async () => {
    await seedApplicationChain()
    const { result } = renderHookWithProviders(() => useDashboardSummary())

    await waitFor(() => expect(result.current.data?.classes).toBe(1), { timeout: 8000 })

    expect(result.current.data).toMatchObject({ questions: 2, exams: 1, applications: 1 })
    expect(result.current.data?.recent[0]).toMatchObject({ title: 'Prova de teste', detail: 'Turma' })
  })

  /** What the next step (#202) weighs: the students who get a paper and the applications still open, with their progress. */
  it('reads the students and the open applications for the next step, in the demo too', async () => {
    await seedApplicationChain()
    const { result } = renderHookWithProviders(() => useDashboardSummary())

    await waitFor(() => expect(result.current.data?.classes).toBe(1), { timeout: 8000 })

    expect(result.current.data?.students).toBe(2)
    expect(result.current.data).not.toHaveProperty('classWithoutStudents')
    expect(result.current.data?.open).toEqual([
      expect.objectContaining({ title: 'Prova de teste', status: 'draft', progress: expect.objectContaining({ sheets: 0, corrections: 0 }) }),
    ])
  })

  it('surfaces a failure instead of an empty panel', async () => {
    const { result } = renderHookWithProviders(() => useDashboardSummary(), withDashboard(() => Promise.reject(new Error('offline'))))

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
