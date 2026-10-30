import { describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../api-client'
import { createHttpReportRepository } from '../create-http-report-repository'

const SUMMARY = { count: 1, mean: 8, median: 8, standardDeviation: 0, lowest: 8, highest: 8 }

function fakeApi(answer: unknown) {
  const request = vi.fn<ApiClient['request']>(() => Promise.resolve(answer))
  return { api: { request }, request }
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

  /** A report in a shape the contract does not describe is an error on screen, never numbers made up from it. */
  it('refuses an answer the contract does not describe', async () => {
    const { api } = fakeApi({ classes: 'muitas' })

    await expect(createHttpReportRepository(api).dashboard()).rejects.toMatchObject({ code: 'failure' })
  })
})
