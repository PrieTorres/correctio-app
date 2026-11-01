import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { useBackgroundJobs } from '@/lib/background-jobs'
import { createTeacherRepositories, type ReportRepository } from '@/lib/repositories'
import { NO_REPORT_FILTERS } from '@/lib/reports'
import { clearAllCollections } from '@/lib/storage/collection'
import { renderHookWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import { exportLabel, REPORT_KIND, useExportReport } from '../useExportReport'

const FILE = { blob: new Blob(['%PDF-1.7']), filename: 'relatorio-aplicacao-2026-10-05.pdf' }

function withExports(exports: Partial<Pick<ReportRepository, 'exportApplication' | 'exportConsolidated'>>) {
  const repositories = createTeacherRepositories(TEST_TEACHER_ID)
  return { repositories: { ...repositories, reports: { ...repositories.reports, ...exports } } }
}

describe('useExportReport', () => {
  beforeEach(clearAllCollections)

  it('exports the report of the application in the format asked, as a background job', async () => {
    const exportApplication = vi.fn<ReportRepository['exportApplication']>(() => Promise.resolve(FILE))
    const { result } = renderHookWithProviders(() => ({ exporter: useExportReport(), jobs: useBackgroundJobs() }), withExports({ exportApplication }))

    act(() => result.current.exporter.start({ kind: REPORT_KIND.APPLICATION, applicationId: 'a1' }, 'pdf'))

    await waitFor(() => expect(result.current.jobs).toMatchObject([{ type: 'EXPORT', status: 'DONE', label: 'Relatório da aplicação em PDF', file: FILE }]))
    expect(exportApplication).toHaveBeenCalledWith('a1', 'pdf')
  })

  /** The file holds the rows on screen, so the filters go with the request. */
  it('exports the consolidated report with the filters on screen', async () => {
    const exportConsolidated = vi.fn<ReportRepository['exportConsolidated']>(() => Promise.resolve(FILE))
    const filters = { ...NO_REPORT_FILTERS, subject: 'Física' }
    const { result } = renderHookWithProviders(() => useExportReport(), withExports({ exportConsolidated }))

    act(() => result.current.start({ kind: REPORT_KIND.CONSOLIDATED, filters }, 'xlsx'))

    await waitFor(() => expect(exportConsolidated).toHaveBeenCalledWith('xlsx', filters))
  })

  /** RNF13: one export at a time; the buttons read this to wait. */
  it('tells the buttons an export is running until it ends', async () => {
    let finish: () => void = () => undefined
    const exportApplication = vi.fn<ReportRepository['exportApplication']>(
      () =>
        new Promise((resolve) => {
          finish = () => resolve(FILE)
        }),
    )
    const { result } = renderHookWithProviders(() => useExportReport(), withExports({ exportApplication }))

    act(() => result.current.start({ kind: REPORT_KIND.APPLICATION, applicationId: 'a1' }, 'csv'))
    await waitFor(() => expect(result.current.running).toBe(true))
    act(() => finish())

    await waitFor(() => expect(result.current.running).toBe(false))
  })

  /** The demo has no server to draw the file, and says so in the notice instead of pretending. */
  it('says the demo cannot export', async () => {
    const { result } = renderHookWithProviders(() => ({ exporter: useExportReport(), jobs: useBackgroundJobs() }))

    act(() => result.current.exporter.start({ kind: REPORT_KIND.APPLICATION, applicationId: 'a1' }, 'csv'))

    await waitFor(() => expect(result.current.jobs).toMatchObject([{ status: 'FAILED', error: 'A exportação é feita pelo servidor e não existe nesta demonstração.' }]))
  })
})

describe('exportLabel', () => {
  it('names the report and the format, never a student', () => {
    expect(exportLabel({ kind: REPORT_KIND.CONSOLIDATED, filters: NO_REPORT_FILTERS }, 'xlsx')).toBe('Relatório consolidado em Excel')
  })
})
