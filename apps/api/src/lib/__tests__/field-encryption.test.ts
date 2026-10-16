import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createFieldCipher, refuseWithoutKey } from '../field-encryption'

const ADDRESS = 'ana.beatriz@exemplo.edu.br'
const newKey = () => randomBytes(32).toString('base64')

describe('createFieldCipher', () => {
  const cipher = createFieldCipher(newKey())

  it('gives back the address it encrypted', () => {
    expect(cipher.decrypt(cipher.encrypt(ADDRESS))).toBe(ADDRESS)
  })

  it('never writes the address itself, and writes it differently every time', () => {
    const first = cipher.encrypt(ADDRESS)
    const second = cipher.encrypt(ADDRESS)

    expect(first).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/)
    expect(first).not.toContain('ana.beatriz')
    expect(first).not.toBe(second)
  })

  it('fits an address of 254 characters in the 512 of the column', () => {
    expect(cipher.encrypt('a'.repeat(254)).length).toBeLessThanOrEqual(512)
  })

  it('refuses a value changed in the database instead of decrypting it into another', () => {
    const [version, iv, tag, encrypted = ''] = cipher.encrypt(ADDRESS).split('.')
    const changed = Buffer.from(encrypted, 'base64url')
    changed.writeUInt8(changed.readUInt8(0) ^ 1, 0)

    expect(() => cipher.decrypt([version, iv, tag, changed.toString('base64url')].join('.'))).toThrow()
  })

  it('cannot be read with another key', () => {
    const stored = cipher.encrypt(ADDRESS)

    expect(() => createFieldCipher(newKey()).decrypt(stored)).toThrow()
  })

  it('refuses text it did not write', () => {
    const stored = cipher.encrypt(ADDRESS)

    expect(() => cipher.decrypt(ADDRESS)).toThrow(/field cipher/)
    expect(() => cipher.decrypt(`v2${stored.slice(2)}`)).toThrow(/field cipher/)
    expect(() => cipher.decrypt(`${stored}.extra`)).toThrow(/field cipher/)
  })

  it('refuses a key that is not 32 bytes', () => {
    expect(() => createFieldCipher(randomBytes(16).toString('base64'))).toThrow(/32 bytes/)
  })
})

describe('refuseWithoutKey', () => {
  it('refuses both ways, so an app without a key never stores an address in plain text', () => {
    expect(() => refuseWithoutKey.encrypt(ADDRESS)).toThrow(/DATA_ENCRYPTION_KEY/)
    expect(() => refuseWithoutKey.decrypt('v1.a.b.c')).toThrow(/DATA_ENCRYPTION_KEY/)
  })
})
