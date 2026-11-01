import { describe, expect, it } from 'vitest'
import { createInviteCode } from '../id'

describe('class invite code', () => {
  it('is 8 characters a teacher can dictate, without the ones ambiguous on paper', () => {
    expect(createInviteCode()).toMatch(/^[A-Z2-7]{8}$/)
  })
})
