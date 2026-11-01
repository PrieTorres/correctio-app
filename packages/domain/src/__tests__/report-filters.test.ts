import { describe, expect, it } from 'vitest'
import { filterReportRows, hasReportFilters, NO_REPORT_FILTERS, readReportFilters } from '../report-filters'

const ROWS = [
  { id: 'a', classId: 'c1', subject: 'Matemática', term: '2026/1', date: '2026-03-10T12:00:00.000Z' },
  { id: 'b', classId: 'c2', subject: 'Física', term: '2026/1', date: '2026-04-20T12:00:00.000Z' },
  { id: 'c', classId: 'c3', subject: 'Matemática', term: '2026/2', date: '2026-09-05T12:00:00.000Z' },
]

const ids = (filters: Partial<typeof NO_REPORT_FILTERS>) =>
  filterReportRows(ROWS, { ...NO_REPORT_FILTERS, ...filters }).map((row) => row.id)

describe('filterReportRows', () => {
  it('keeps every row when nothing is filtered', () => {
    expect(ids({})).toEqual(['a', 'b', 'c'])
  })

  it('filters by class, subject and term', () => {
    expect(ids({ classId: 'c2' })).toEqual(['b'])
    expect(ids({ subject: 'Matemática' })).toEqual(['a', 'c'])
    expect(ids({ term: '2026/1' })).toEqual(['a', 'b'])
  })

  it('combines the filters', () => {
    expect(ids({ subject: 'Matemática', term: '2026/1' })).toEqual(['a'])
  })

  it('includes both ends of the date range', () => {
    expect(ids({ from: '2026-03-10', to: '2026-04-20' })).toEqual(['a', 'b'])
  })

  it('accepts a range open on one side', () => {
    expect(ids({ from: '2026-04-01' })).toEqual(['b', 'c'])
    expect(ids({ to: '2026-04-01' })).toEqual(['a'])
  })

  it('answers with nothing when no row matches', () => {
    expect(ids({ subject: 'Química' })).toEqual([])
  })
})

describe('readReportFilters', () => {
  it('reads each filter from its URL parameter', () => {
    const params = new URLSearchParams('class=c1&subject=Física&term=2026/2&from=2026-01-01&to=2026-12-31')

    expect(readReportFilters((name) => params.get(name))).toEqual({
      classId: 'c1',
      subject: 'Física',
      term: '2026/2',
      from: '2026-01-01',
      to: '2026-12-31',
    })
  })

  it('reads an empty URL as no filters', () => {
    expect(readReportFilters(() => undefined)).toEqual(NO_REPORT_FILTERS)
  })
})

describe('hasReportFilters', () => {
  it('tells whether any filter is on', () => {
    expect(hasReportFilters(NO_REPORT_FILTERS)).toBe(false)
    expect(hasReportFilters({ ...NO_REPORT_FILTERS, term: '2026/1' })).toBe(true)
  })
})
