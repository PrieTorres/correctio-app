import { describe, expect, it } from 'vitest'
import { APPLICATION_FILTER, applicationListPath, parseApplicationFilter } from '../application-filter'

describe('parseApplicationFilter', () => {
  it('reads each known filter', () => {
    expect(parseApplicationFilter('archived')).toBe(APPLICATION_FILTER.ARCHIVED)
    expect(parseApplicationFilter('correction-in-progress')).toBe(APPLICATION_FILTER.IN_PROGRESS)
  })

  /** A hand-edited or outdated link must open the normal list, not an empty one. */
  it('falls back to the active list for a missing or unknown value', () => {
    expect(parseApplicationFilter(null)).toBe(APPLICATION_FILTER.ACTIVE)
    expect(parseApplicationFilter('nonsense')).toBe(APPLICATION_FILTER.ACTIVE)
  })
})

describe('applicationListPath', () => {
  it('builds the link the panel card follows', () => {
    expect(applicationListPath(APPLICATION_FILTER.IN_PROGRESS)).toBe('/aplicacoes?status=correction-in-progress')
  })
})
