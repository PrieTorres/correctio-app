import { describe, expect, it } from 'vitest'
import { createAnswerSheetCode } from '../id'

describe('answer sheet code', () => {
  it('is 26 characters long and never repeats', () => {
    const codes = new Set(Array.from({ length: 1000 }, createAnswerSheetCode))
    expect(codes.size).toBe(1000)
    codes.forEach((code) => expect(code).toHaveLength(26))
  })

  it('avoids characters that are ambiguous on printed paper', () => {
    expect(createAnswerSheetCode()).toMatch(/^[A-Z2-7]{26}$/)
  })
})
