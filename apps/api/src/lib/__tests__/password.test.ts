import { describe, expect, it } from 'vitest'
import { hashPassword, unusablePasswordHash, verifyPassword } from '../password'

describe('password', () => {
  it('hashes with argon2id and checks the password against the hash', async () => {
    const hash = await hashPassword('senha-forte-1')

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/)
    expect(await verifyPassword(hash, 'senha-forte-1')).toBe(true)
    expect(await verifyPassword(hash, 'senha-forte-2')).toBe(false)
  })

  it('treats a hash that is not argon2 as a wrong password', async () => {
    expect(await verifyPassword('x', 'x')).toBe(false)
  })

  it('makes a hash no typed password matches', async () => {
    const hash = await unusablePasswordHash()

    expect(await verifyPassword(hash, '')).toBe(false)
    expect(hash).not.toBe(await unusablePasswordHash())
  })
})
