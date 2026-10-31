import { describe, expect, it, vi } from 'vitest'
import { StorageError } from '@/lib/storage/errors'
import type { ApiClient, FileClient, HttpMethod, RequestOptions } from '../api-client'
import { createHttpApplicationRepository } from '../create-http-application-repository'

type Answer = (method: HttpMethod, path: string, options?: RequestOptions) => Promise<unknown>

function fakeApi(answer: Answer, file: Awaited<ReturnType<FileClient['download']>> = { blob: new Blob() }) {
  const request = vi.fn<ApiClient['request']>(answer)
  const download = vi.fn<FileClient['download']>(() => Promise.resolve(file))
  const upload = vi.fn<FileClient['upload']>()
  return { api: { request, download, upload }, request, download }
}

const OVERVIEW = {
  id: 'a1',
  examId: 'e1',
  classId: 'c1',
  teacherId: 'ana',
  status: 'generated',
  pdfUrl: '/applications/a1/pdf',
  date: '2026-10-05T12:00:00.000Z',
  gradesReleased: false,
  examTitle: 'Cálculo I — P1',
  className: 'Turma A',
  progress: { versions: 2, publishedAnswerKeys: 1, sheets: 30, correctedSheets: 12, corrections: 14 },
}

const VERSION = {
  id: 'v1',
  applicationId: 'a1',
  versionNumber: 1,
  shuffleQuestions: true,
  shuffleAlternatives: false,
  withStudentIdentification: true,
  layout: { questionOrder: ['q1'], alternativeOrder: [{ questionId: 'q1', printedOrder: ['x', 'y'] }] },
  answerKeyPublished: false,
  publicCode: 'PUB1',
  qrCodePayload: 'PUB1',
}

const SHEET = { id: 's1', applicationId: 'a1', examVersionId: 'v1', studentId: 'st1', sheetNumber: 1, code: 'K7M2QX9RT4BV8NC3HW6PJ5DZ2A' }

describe('createHttpApplicationRepository', () => {
  it('lists with the filters of P11, each application with its overview', async () => {
    const { api, request } = fakeApi(() => Promise.resolve({ items: [OVERVIEW], total: 1 }))

    const page = await createHttpApplicationRepository(api).list({
      search: '05/10',
      archived: false,
      page: 2,
      pageSize: 20,
      classId: 'c1',
      examId: 'e1',
      status: 'generated',
      correction: 'IN_PROGRESS',
    })

    expect(request).toHaveBeenCalledWith('GET', '/applications', {
      query: { search: '05/10', archived: false, page: 2, pageSize: 20, classId: 'c1', examId: 'e1', status: 'generated', correction: 'IN_PROGRESS' },
    })
    expect(page).toEqual({ items: [OVERVIEW], total: 1 })
  })

  it('refuses an application that comes without its overview, rather than showing it half empty', async () => {
    const { api } = fakeApi(() => Promise.resolve({ items: [{ ...OVERVIEW, progress: undefined }], total: 1 }))

    await expect(createHttpApplicationRepository(api).list()).rejects.toBeInstanceOf(StorageError)
  })

  it('generates on the server with only the options of P13, and answers what was printed', async () => {
    const { api, request } = fakeApi(() => Promise.resolve({ versions: [VERSION], sheets: [SHEET] }))
    const generation = { versions: [{ shuffleQuestions: true, shuffleAlternatives: false }], withStudentIdentification: true }

    const paper = await createHttpApplicationRepository(api).generate('a 1', generation)

    expect(request).toHaveBeenCalledWith('POST', '/applications/a%201/generate-pdf', { body: generation })
    expect(paper.versions).toEqual([VERSION])
    expect(paper.sheets).toEqual([{ ...SHEET, answerCardVersion: 1 }])
  })

  it('releases and takes back the grades through their own route, answering the overview', async () => {
    const { api, request } = fakeApi(() => Promise.resolve({ ...OVERVIEW, gradesReleased: true }))

    const released = await createHttpApplicationRepository(api).setGradesReleased('a1', true)

    expect(request).toHaveBeenCalledWith('POST', '/applications/a1/grades-release', { body: { released: true } })
    expect(released.gradesReleased).toBe(true)
  })

  it('downloads the PDF with the name the API gave it, or a plain one when it gave none', async () => {
    const blob = new Blob(['%PDF-1.7'])
    const named = fakeApi(() => Promise.resolve(undefined), { blob, filename: 'prova-2026-10-05.pdf' })
    const unnamed = fakeApi(() => Promise.resolve(undefined), { blob })

    expect(await createHttpApplicationRepository(named.api).downloadPdf('a1')).toEqual({ blob, filename: 'prova-2026-10-05.pdf' })
    expect(await createHttpApplicationRepository(unnamed.api).downloadPdf('a1')).toEqual({ blob, filename: 'prova.pdf' })
    expect(named.download).toHaveBeenCalledWith('/applications/a1/pdf')
  })
})
