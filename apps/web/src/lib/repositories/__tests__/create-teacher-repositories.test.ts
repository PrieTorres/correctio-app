import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAllCollections } from '@/lib/storage/collection'
import type { ApiClient, FileClient } from '../http/api-client'
import { createTeacherRepositories } from '..'

const EMPTY_PAGE = { items: [], total: 0 }

/** A client that answers every read with an empty page, recording what was asked of the server. */
function fakeApi() {
  const request = vi.fn<ApiClient['request']>(() => Promise.resolve(EMPTY_PAGE))
  const download = vi.fn<FileClient['download']>()
  return { api: { request, download }, request }
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

  /** The corrections move to the API with their own screens (#48); until then they stay in this browser. */
  it('keeps the corrections in this browser even with a client', async () => {
    const { api, request } = fakeApi()

    await createTeacherRepositories('ana', api).corrections.listByAnswerSheets(['sheet-1'])

    expect(request).not.toHaveBeenCalled()
  })

  it('generates in this browser when there is no client, as the demo does', async () => {
    const { applications } = createTeacherRepositories('ana')

    const created = await applications.create({ examId: 'exam-1', classId: 'class-1', date: '2026-10-05T12:00:00.000Z' })

    await expect(applications.getById(created.id)).resolves.toMatchObject({ status: 'draft', progress: { versions: 0 } })
  })
})
