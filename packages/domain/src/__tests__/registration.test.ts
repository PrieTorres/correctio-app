import { describe, expect, it } from 'vitest'
import { registrationKey } from '../registration'

describe('registrationKey', () => {
  it('ignores case', () => {
    expect(registrationKey('ab1')).toBe(registrationKey('AB1'))
  })

  it('ignores accents', () => {
    expect(registrationKey('Ção-01')).toBe(registrationKey('cao-01'))
  })

  /** The collation does not pad, so the index stores "AB1 " apart from "AB1"; skipping it would lose a student. */
  it('keeps the spaces, as the unique index does', () => {
    expect(registrationKey('AB1 ')).not.toBe(registrationKey('AB1'))
  })
})
