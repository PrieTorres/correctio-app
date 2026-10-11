import { describe, expect, it } from 'vitest'
import { ApiError } from '../api-error'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, pageWindow, parsePageRequest } from '../pagination'

describe('parsePageRequest', () => {
  it('starts at the first page with the default size', () => {
    expect(parsePageRequest({})).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE, search: '', archived: false })
  })

  it('reads the values a query string carries as text', () => {
    expect(parsePageRequest({ page: '3', pageSize: '20', search: '  cálculo ', archived: 'true' })).toEqual({
      page: 3,
      pageSize: 20,
      search: 'cálculo',
      archived: true,
    })
  })

  it('refuses a page size above the ceiling instead of cutting it', () => {
    expect(() => parsePageRequest({ pageSize: String(MAX_PAGE_SIZE + 1) })).toThrow(ApiError)

    try {
      parsePageRequest({ pageSize: String(MAX_PAGE_SIZE + 1) })
    } catch (error) {
      expect((error as ApiError).status).toBe(400)
      expect((error as ApiError).code).toBe('invalid')
      expect((error as ApiError).message).toContain('pageSize')
    }
  })

  it('accepts exactly the ceiling, which the web app still asks for', () => {
    expect(parsePageRequest({ pageSize: String(MAX_PAGE_SIZE) }).pageSize).toBe(MAX_PAGE_SIZE)
  })

  it('refuses a page before the first and a flag that is not true or false', () => {
    expect(() => parsePageRequest({ page: '0' })).toThrow(ApiError)
    expect(() => parsePageRequest({ archived: 'yes' })).toThrow(ApiError)
  })
})

describe('pageWindow', () => {
  it('turns a page into the limit and offset of a query', () => {
    expect(pageWindow({ page: 1, pageSize: 50 })).toEqual({ limit: 50, offset: 0 })
    expect(pageWindow({ page: 3, pageSize: 20 })).toEqual({ limit: 20, offset: 40 })
  })
})
