import { describe, expect, it, vi } from 'vitest'
import { NO_REPORT_FILTERS } from '@correctio/domain'
import type { ApiClient, FileClient } from '../api-client'
import { createHttpReportRepository } from '../create-http-report-repository'

const SUMMARY = { count: 1, mean: 8, median: 8, standardDeviation: 0, lowest: 8, highest: 8 }

/** `filename: null` stands for an answer without `Content-Disposition`. */
function fakeApi(answer: unknown, filename: string | null = 'relatorio-consolidado-2026-10-30.xlsx') {
  const request = vi.fn<ApiClient['request']>(() => Promise.resolve(answer))
  const download = vi.fn<FileClient['download']>(() => Promise.resolve({ blob: new Blob(['PK']), ...(filename !== null && { filename }) }))
  return { api: { request, download }, request, download }
}

describe('createHttpReportRepository', () => {
  it('reads the panel from its own route', async () => {
    const dashboard = { classes: 1, questions: 2, exams: 3, applications: 4, pendingCorrections: 0, recent: [], gradable: [] }
    const { api, request } = fakeApi(dashboard)

    expect(await createHttpReportRepository(api).dashboard()).toEqual(dashboard)
    expect(request).toHaveBeenCalledWith('GET', '/dashboard')
  })

  it('reads the report under its application, escaping the id', async () => {
    const report = {
      applicationId: 'a 1',
      examTitle: 'Prova',
      className: 'Turma',
      date: '2026-10-05T12:00:00.000Z',
      maximumScore: 10,
      sheets: 2,
      inProgress: 1,
      summary: SUMMARY,
      distribution: [],
      questions: [],
      tags: [],
      students: [{ correctionId: 'c1', name: 'Folha 2', registration: '', versionNumber: 1, totalScore: 8, questionScores: [8, null] }],
    }
    const { api, request } = fakeApi(report)

    expect(await createHttpReportRepository(api).application('a 1')).toEqual(report)
    expect(request).toHaveBeenCalledWith('GET', '/applications/a%201/report')
  })

  it('reads the consolidated rows', async () => {
    const row = { applicationId: 'a1', examTitle: 'Prova', classId: 'c1', className: 'Turma', subject: 'Física', term: '2026/2', date: '2026-10-05T12:00:00.000Z', summary: SUMMARY }
    const { api, request } = fakeApi([row])

    expect(await createHttpReportRepository(api).consolidated()).toEqual([row])
    expect(request).toHaveBeenCalledWith('GET', '/reports/consolidated')
  })

  /** RF36: the file comes from the same route with `?format=`, with the teacher's token. */
  it('downloads the file of the application report in the format asked', async () => {
    const { api, download } = fakeApi(undefined, 'relatorio-aplicacao-2026-10-05.pdf')

    const file = await createHttpReportRepository(api).exportApplication('a 1', 'pdf')

    expect(download).toHaveBeenCalledWith('/applications/a%201/report?format=pdf')
    expect(file.filename).toBe('relatorio-aplicacao-2026-10-05.pdf')
  })

  /** The file holds the rows on screen: the filters go along by the names of the address, the empty ones left out. */
  it('downloads the consolidated file with the filters on screen', async () => {
    const { api, download } = fakeApi(undefined)

    await createHttpReportRepository(api).exportConsolidated('xlsx', { ...NO_REPORT_FILTERS, classId: 'c 1', from: '2026-10-01' })

    expect(download).toHaveBeenCalledWith('/reports/consolidated?format=xlsx&class=c+1&from=2026-10-01')
  })

  it('names the file by its format when the server does not', async () => {
    const { api } = fakeApi(undefined, null)

    expect((await createHttpReportRepository(api).exportConsolidated('csv', NO_REPORT_FILTERS)).filename).toBe('relatorio.csv')
  })

  /** A report in a shape the contract does not describe is an error on screen, never numbers made up from it. */
  it('refuses an answer the contract does not describe', async () => {
    const { api } = fakeApi({ classes: 'muitas' })

    await expect(createHttpReportRepository(api).dashboard()).rejects.toMatchObject({ code: 'failure' })
  })
})
