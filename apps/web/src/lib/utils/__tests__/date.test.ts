import { describe, expect, it } from 'vitest'
import { formatShortDate } from '../date'

describe('formatShortDate', () => {
  it('renders the day and the full month name in Portuguese', () => {
    expect(formatShortDate('2026-09-10T18:40:00.000Z')).toBe('10 de setembro')
  })

  it('has no year, since it is meant for lists too short for a full date', () => {
    expect(formatShortDate('2026-01-05T00:00:00.000Z')).not.toContain('2026')
  })
})
