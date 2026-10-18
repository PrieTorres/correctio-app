import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ApiError } from '../api-error'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, pageWindow, parseListRequest, parsePageRequest } from '../pagination'

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
      expect((error as ApiError).message).toBe(`Parâmetro de lista inválido: pageSize. O máximo por página é ${MAX_PAGE_SIZE}.`)
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

describe('parseListRequest', () => {
  const filters = { status: z.enum(['draft', 'closed']).optional() }

  it('reads the filters of an entity together with the shared parameters', () => {
    expect(parseListRequest({ status: 'draft', page: '2' }, filters)).toEqual({
      page: 2,
      pageSize: DEFAULT_PAGE_SIZE,
      search: '',
      archived: false,
      status: 'draft',
    })
  })

  it('lists everything when a filter is left out', () => {
    expect(parseListRequest({}, filters)).not.toHaveProperty('status')
  })

  /** The ceiling of a page says nothing about a filter, so only the parameter is named. */
  it('refuses a filter value it does not know, naming the filter', () => {
    expect(() => parseListRequest({ status: 'archived' }, filters)).toThrow(
      new ApiError('invalid', 'Parâmetro de lista inválido: status.'),
    )
  })
})

describe('pageWindow', () => {
  it('turns a page into the limit and offset of a query', () => {
    expect(pageWindow({ page: 1, pageSize: 50 })).toEqual({ limit: 50, offset: 0 })
    expect(pageWindow({ page: 3, pageSize: 20 })).toEqual({ limit: 20, offset: 40 })
  })
})
