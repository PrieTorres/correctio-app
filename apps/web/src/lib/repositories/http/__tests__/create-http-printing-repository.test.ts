import { describe, expect, it, vi } from 'vitest'
import { StorageError } from '@/lib/storage/errors'
import type { ApiClient, HttpMethod, RequestOptions } from '../api-client'
import { createHttpPrintingRepository } from '../create-http-printing-repository'
import { LARGEST_PAGE } from '../read-every-page'

type Answer = (method: HttpMethod, path: string, options?: RequestOptions) => Promise<unknown>

function fakeApi(answer: Answer) {
  const request = vi.fn<ApiClient['request']>(answer)
  return { api: { request }, request }
}

const sheet = (number: number) => ({
  id: `s${number}`,
  applicationId: 'a1',
  examVersionId: 'v1',
  sheetNumber: number,
  code: `CODE${String(number).padStart(22, '0')}`,
  answerCardVersion: 1,
})

describe('createHttpPrintingRepository', () => {
  it('reads the versions under the application, in the largest pages the API serves', async () => {
    const { api, request } = fakeApi(() => Promise.resolve({ items: [], total: 0 }))

    await createHttpPrintingRepository(api).listVersions('a 1')

    expect(request).toHaveBeenCalledWith('GET', '/applications/a%201/versions', { query: { page: 1, pageSize: LARGEST_PAGE } })
  })

  /** A class longer than one page still gets every sheet, as the browser version gives them. */
  it('reads every page of the sheets of a large class', async () => {
    const total = LARGEST_PAGE + 1
    const { api, request } = fakeApi((_method, _path, options) => {
      const page = Number(options?.query?.page)
      const items = page === 1 ? Array.from({ length: LARGEST_PAGE }, (_, index) => sheet(index + 1)) : [sheet(total)]
      return Promise.resolve({ items, total })
    })

    const sheets = await createHttpPrintingRepository(api).listSheets('a1')

    expect(sheets).toHaveLength(total)
    expect(sheets.at(-1)?.sheetNumber).toBe(total)
    expect(request).toHaveBeenLastCalledWith('GET', '/applications/a1/sheets', { query: { page: 2, pageSize: LARGEST_PAGE } })
  })

  it('publishes or takes back one answer key under its application', async () => {
    const { api, request } = fakeApi(() => Promise.resolve(undefined))

    await createHttpPrintingRepository(api).publishAnswerKey('a1', 'v 1', false)

    expect(request).toHaveBeenCalledWith('POST', '/applications/a1/versions/v%201/publish-answer-key', { body: { published: false } })
  })

  it('publishes every answer key with one request', async () => {
    const { api, request } = fakeApi(() => Promise.resolve(undefined))

    await createHttpPrintingRepository(api).publishAll('a1')

    expect(request).toHaveBeenCalledOnce()
    expect(request).toHaveBeenCalledWith('POST', '/applications/a1/publish-answer-keys')
  })

  it('never looks a sheet up by its code for a teacher, which only the public route does', async () => {
    const { api, request } = fakeApi(() => Promise.resolve(null))

    await expect(createHttpPrintingRepository(api).findSheetByCode('K7M2')).rejects.toBeInstanceOf(StorageError)
    expect(request).not.toHaveBeenCalled()
  })
})
