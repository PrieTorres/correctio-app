import { describe, expect, it } from 'vitest'
import { cn } from '../cn'

describe('cn', () => {
  it('joins the classes that are present', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops falsy values so conditionals read inline', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('returns an empty string when nothing applies', () => {
    expect(cn(false, null)).toBe('')
  })
})
