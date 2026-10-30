import { describe, expect, it } from 'vitest'
import { NO_REPORT_FILTERS } from '@correctio/domain'
import { readReportFilters } from '../filters'

describe('readReportFilters', () => {
  it('reads each filter from its parameter in the address', () => {
    const params = new URLSearchParams('class=c1&subject=Física&term=2026/2&from=2026-01-01&to=2026-12-31')

    expect(readReportFilters(params)).toEqual({ classId: 'c1', subject: 'Física', term: '2026/2', from: '2026-01-01', to: '2026-12-31' })
  })

  it('reads an address without parameters as no filters', () => {
    expect(readReportFilters(new URLSearchParams())).toEqual(NO_REPORT_FILTERS)
  })
})
