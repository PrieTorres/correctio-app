import { describe, expect, it } from 'vitest'
import { LARGEST_PAGE } from '@/lib/repositories/read-every-page'
import { APPLICATION_FILTER } from '../application-filter'
import {
  APPLICATION_PAGE_SIZE,
  effectiveFilters,
  filterOptionsOf,
  hasApplicationListFilters,
  listParamsOf,
  NO_APPLICATION_LIST_FILTERS,
  offersPdfFilter,
  pageOf,
  readApplicationListFilters,
} from '../list-filters'

const CHOSEN = { classId: 'class-1', examId: 'exam-1', pdf: 'generated' } as const

describe('readApplicationListFilters', () => {
  it('reads each filter from its URL parameter', () => {
    expect(readApplicationListFilters(new URLSearchParams('class=class-1&exam=exam-1&pdf=draft&status=archived'))).toEqual({
      classId: 'class-1',
      examId: 'exam-1',
      pdf: 'draft',
    })
  })

  /** A link from anywhere can carry anything; a paper filter the list does not know filters nothing. */
  it('reads an absent or unknown filter as no restriction', () => {
    expect(readApplicationListFilters(new URLSearchParams(''))).toEqual(NO_APPLICATION_LIST_FILTERS)
    expect(readApplicationListFilters(new URLSearchParams('pdf=closed')).pdf).toBe('')
  })
})

describe('the paper filter', () => {
  it('is offered among the active applications only', () => {
    expect(offersPdfFilter(APPLICATION_FILTER.ACTIVE)).toBe(true)
    expect(offersPdfFilter(APPLICATION_FILTER.ARCHIVED)).toBe(false)
    expect(offersPdfFilter(APPLICATION_FILTER.IN_PROGRESS)).toBe(false)
  })

  /** Kept in the URL for the way back to the active ones, but off meanwhile. */
  it('neither filters nor counts as on where it is not offered', () => {
    expect(effectiveFilters(APPLICATION_FILTER.ACTIVE, CHOSEN)).toEqual(CHOSEN)
    expect(effectiveFilters(APPLICATION_FILTER.ARCHIVED, CHOSEN)).toEqual({ ...CHOSEN, pdf: '' })
    expect(hasApplicationListFilters(effectiveFilters(APPLICATION_FILTER.ARCHIVED, { ...NO_APPLICATION_LIST_FILTERS, pdf: 'draft' }))).toBe(
      false,
    )
    expect(hasApplicationListFilters({ ...NO_APPLICATION_LIST_FILTERS, examId: 'exam-1' })).toBe(true)
  })
})

describe('listParamsOf', () => {
  it('asks the server for one page of the active applications, filtered by class, exam and paper', () => {
    expect(listParamsOf({ filter: APPLICATION_FILTER.ACTIVE, filters: CHOSEN, search: '05/10', page: 3 })).toEqual({
      search: '05/10',
      archived: false,
      classId: 'class-1',
      examId: 'exam-1',
      status: 'generated',
      page: 3,
      pageSize: APPLICATION_PAGE_SIZE,
    })
  })

  /** The API answers 400 for `generated` among the archived, so the paper never goes along. */
  it('asks for the archived ones without the paper filter', () => {
    expect(listParamsOf({ filter: APPLICATION_FILTER.ARCHIVED, filters: CHOSEN, search: '', page: 1 })).toEqual({
      search: '',
      archived: true,
      classId: 'class-1',
      examId: 'exam-1',
      page: 1,
      pageSize: APPLICATION_PAGE_SIZE,
    })
  })

  it('sends no filter that is not on', () => {
    expect(listParamsOf({ filter: APPLICATION_FILTER.ACTIVE, filters: NO_APPLICATION_LIST_FILTERS, search: '', page: 1 })).toEqual({
      search: '',
      archived: false,
      page: 1,
      pageSize: APPLICATION_PAGE_SIZE,
    })
  })

  /** The corrections still live in this browser (#48), so this view pages on this side. */
  it('asks for every active match at once while showing the corrections in progress', () => {
    const params = listParamsOf({ filter: APPLICATION_FILTER.IN_PROGRESS, filters: CHOSEN, search: '', page: 2 })

    expect(params).toMatchObject({ archived: false, classId: 'class-1', page: 1, pageSize: LARGEST_PAGE })
    expect(params).not.toHaveProperty('status')
  })
})

describe('pageOf', () => {
  it('cuts a list filtered on this side into pages numbered from 1', () => {
    const items = Array.from({ length: APPLICATION_PAGE_SIZE + 3 }, (_, index) => index)

    expect(pageOf(items, 1)).toHaveLength(APPLICATION_PAGE_SIZE)
    expect(pageOf(items, 2)).toEqual([APPLICATION_PAGE_SIZE, APPLICATION_PAGE_SIZE + 1, APPLICATION_PAGE_SIZE + 2])
    expect(pageOf(items, 3)).toEqual([])
  })
})

describe('filterOptionsOf', () => {
  /** Two terms of the same subject often share a name; the archived one says so. */
  it('offers every class or exam in alphabetical order, marking the archived ones', () => {
    const options = filterOptionsOf(
      [
        { id: 'c2', status: 'active', name: 'Física II' },
        { id: 'c1', status: 'archived', name: 'Cálculo I' },
        { id: 'e1', status: 'closed', name: 'Álgebra' },
        { id: 'c3', status: 'active', name: 'Cálculo I' },
      ],
      (item) => item.name,
    )

    expect(options).toEqual([
      { value: 'e1', label: 'Álgebra (arquivada)' },
      { value: 'c3', label: 'Cálculo I' },
      { value: 'c1', label: 'Cálculo I (arquivada)' },
      { value: 'c2', label: 'Física II' },
    ])
  })
})
