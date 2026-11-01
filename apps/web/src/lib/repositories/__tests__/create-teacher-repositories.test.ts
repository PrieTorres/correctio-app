import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAllCollections } from '@/lib/storage/collection'
import type { ApiClient, FileClient } from '../http/api-client'
import { createTeacherRepositories } from '..'

const EMPTY_PAGE = { items: [], total: 0 }

/** A client that answers every read with an empty page, recording what was asked of the server. */
function fakeApi() {
  const request = vi.fn<ApiClient['request']>(() => Promise.resolve(EMPTY_PAGE))
  const download = vi.fn<FileClient['download']>()
  const upload = vi.fn<FileClient['upload']>(() => Promise.resolve({ imageId: 'photo-1', status: 'QR_NOT_RECOGNIZED' }))
  return { api: { request, download, upload }, request, upload }
}

describe('createTeacherRepositories', () => {
  beforeEach(clearAllCollections)

  /** The screens of P11 to P14 read what the server generated, never a copy kept in this browser (#46). */
  it('reads the applications and their versions and sheets from the API when there is a client', async () => {
    const { api, request } = fakeApi()
    const repositories = createTeacherRepositories('ana', api)

    await repositories.applications.list()
    await repositories.printing.listVersions('a 1')
    await repositories.printing.listSheets('a 1')

    const paths = request.mock.calls.map(([method, path]) => `${method} ${path.split('?')[0] ?? ''}`)
    expect(paths).toEqual(['GET /applications', 'GET /applications/a%201/versions', 'GET /applications/a%201/sheets'])
  })

  /** Outside the demo nothing is read in this browser (#51): the other areas reach the API too. */
  it('reads the classes, the students, the questions and the exams from the API when there is a client', async () => {
    const { api, request } = fakeApi()
    const repositories = createTeacherRepositories('ana', api)

    await repositories.classes.list()
    await repositories.students.listByClass('c 1')
    await repositories.questions.list()
    await repositories.exams.list()

    const paths = request.mock.calls.map(([method, path]) => `${method} ${path.split('?')[0] ?? ''}`)
    expect(paths).toEqual(['GET /classes', 'GET /classes/c%201/students', 'GET /questions', 'GET /exams'])
  })

  /** One request each, calculated on the server (#50), instead of every list read here. */
  it('reads the panel and the reports from the API when there is a client', async () => {
    const { api, request } = fakeApi()
    const { reports } = createTeacherRepositories('ana', api)
    request.mockResolvedValueOnce({ classes: 0, questions: 0, exams: 0, applications: 0, pendingCorrections: 0, recent: [], gradable: [] })
    request.mockResolvedValueOnce([])

    await reports.dashboard()
    await reports.consolidated()

    expect(request.mock.calls.map(([method, path]) => `${method} ${path}`)).toEqual(['GET /dashboard', 'GET /reports/consolidated'])
  })

  /** With a client, the corrections and the photos are the API's (#47, #48): nothing of the browser's is left (#51). */
  it('reads the corrections and sends the photos to the API when there is a client', async () => {
    const { api, request, upload } = fakeApi()
    const { corrections, sheetImages } = createTeacherRepositories('ana', api)

    await corrections.listByApplication('a 1')
    await sheetImages.upload('a 1', new Blob(['photo']))

    expect(request.mock.calls.map(([method, path]) => `${method} ${path}`)).toEqual(['GET /applications/a%201/corrections'])
    expect(upload).toHaveBeenCalledWith('/applications/a%201/sheet-images', expect.any(Blob))
  })

  it('generates in this browser when there is no client, as the demo does', async () => {
    const { applications } = createTeacherRepositories('ana')

    const created = await applications.create({ examId: 'exam-1', classId: 'class-1', date: '2026-10-05T12:00:00.000Z' })

    await expect(applications.getById(created.id)).resolves.toMatchObject({ status: 'draft', progress: { versions: 0 } })
  })
})
