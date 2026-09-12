import { describe, expect, it } from 'vitest'
import { formatDate, fromDateInputValue, toDateInputValue } from '../date'

describe('formatDate', () => {
  it('reads as a Brazilian date', () => {
    expect(formatDate('2026-10-05T13:00:00.000Z')).toBe('05/10/2026')
  })

  it('gives back what it was handed when that is not a date', () => {
    expect(formatDate('nem data')).toBe('nem data')
  })
})

describe('toDateInputValue', () => {
  it('produces what a date input reads', () => {
    expect(toDateInputValue('2026-10-05T13:00:00.000Z')).toBe('2026-10-05')
  })

  it('produces nothing usable from nothing usable', () => {
    expect(toDateInputValue('nem data')).toBe('')
  })
})

describe('fromDateInputValue', () => {
  /**
   * Midday rather than midnight: a date stored at midnight UTC reads as the
   * previous day anywhere west of Greenwich, which is all of Brazil.
   */
  it('keeps the day the teacher picked, in this timezone', () => {
    expect(toDateInputValue(fromDateInputValue('2026-10-05'))).toBe('2026-10-05')
  })

  it('round-trips through the stored form', () => {
    const stored = fromDateInputValue('2026-01-31')

    expect(formatDate(stored)).toBe('31/01/2026')
  })

  it('produces nothing usable from an empty field', () => {
    expect(fromDateInputValue('')).toBe('')
  })
})
