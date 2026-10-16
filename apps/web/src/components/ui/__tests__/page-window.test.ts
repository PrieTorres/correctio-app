import { describe, expect, it } from 'vitest'
import { pageWindow } from '../page-window'

describe('pageWindow', () => {
  it('covers the first page of a long list', () => {
    expect(pageWindow({ page: 1, pageSize: 50, total: 73 })).toEqual({ first: 1, last: 50, pageCount: 2 })
  })

  it('stops the last page at the total', () => {
    expect(pageWindow({ page: 2, pageSize: 50, total: 73 })).toEqual({ first: 51, last: 73, pageCount: 2 })
  })

  it('fits an exact multiple in whole pages', () => {
    expect(pageWindow({ page: 2, pageSize: 50, total: 100 }).pageCount).toBe(2)
  })

  it('counts an empty list as one page with nothing on it', () => {
    expect(pageWindow({ page: 1, pageSize: 50, total: 0 })).toEqual({ first: 0, last: 0, pageCount: 1 })
  })
})
