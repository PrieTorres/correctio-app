import { beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { createTeacherRepositories, type ReportRepository } from '@/lib/repositories'
import type { ConsolidatedReportRow } from '@/lib/reports'
import { clearAllCollections } from '@/lib/storage/collection'
import { renderHookWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import { seedApplicationChain } from '@/test-fixtures'
import { useConsolidatedReport } from '../useConsolidatedReport'

const ROW: ConsolidatedReportRow = {
  applicationId: 'a1',
  examTitle: 'Cálculo I',
  classId: 'class-a',
  className: 'Turma A',
  subject: 'Matemática',
  term: '2026/2',
  date: '2026-10-05T12:00:00.000Z',
  summary: { count: 2, mean: 7, median: 7, standardDeviation: 1, lowest: 6, highest: 8 },
}

function withConsolidated(consolidated: ReportRepository['consolidated']) {
  const repositories = createTeacherRepositories(TEST_TEACHER_ID)
  return { repositories: { ...repositories, reports: { ...repositories.reports, consolidated } } }
}

describe('useConsolidatedReport', () => {
  beforeEach(clearAllCollections)

  /** One request instead of two per application (#50); the filters of P19 then read the fields each row carries. */
  it('reads the rows in a single request, with what the filters read', async () => {
    const consolidated = vi.fn(() => Promise.resolve([ROW]))
    const { result } = renderHookWithProviders(() => useConsolidatedReport(), withConsolidated(consolidated))

    await waitFor(() => expect(result.current.data).toEqual([ROW]))
    expect(consolidated).toHaveBeenCalledTimes(1)
  })

  it('lists nothing before anything is corrected', async () => {
    await seedApplicationChain()
    const { result } = renderHookWithProviders(() => useConsolidatedReport())

    await waitFor(() => expect(result.current.data).toEqual([]), { timeout: 8000 })
  })
})
