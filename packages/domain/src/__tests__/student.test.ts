import { describe, expect, it } from 'vitest'
import { studentInputSchema, studentSchema } from '../schemas'

/**
 * The e-mail of a student is optional, and a blank field has to mean that.
 *
 * `.optional()` admits `undefined` and nothing else, so the empty string a form
 * submits for an untouched field was reaching the address check: adding a
 * student with no e-mail was refused with "E-mail inválido".
 */
describe('studentInputSchema', () => {
  const filled = { fullName: 'Ana Beatriz Moreira', registration: '2026001' }

  it('accepts a student whose e-mail was left blank', () => {
    const result = studentInputSchema.safeParse({ ...filled, email: '' })

    expect(result.success).toBe(true)
    expect(result.success && result.data.email).toBeUndefined()
  })

  it('accepts a student with no e-mail key at all', () => {
    const result = studentInputSchema.safeParse(filled)

    expect(result.success).toBe(true)
    expect(result.success && result.data.email).toBeUndefined()
  })

  it('keeps an e-mail that was filled in', () => {
    const result = studentInputSchema.safeParse({ ...filled, email: 'ana@exemplo.edu.br' })

    expect(result.success && result.data.email).toBe('ana@exemplo.edu.br')
  })

  it('still refuses something that is not an address', () => {
    const result = studentInputSchema.safeParse({ ...filled, email: 'ana@' })

    expect(result.success).toBe(false)
    expect(result.success ? [] : result.error.issues.map((issue) => issue.message)).toContain(
      'E-mail inválido',
    )
  })

  /** 254 is the longest address the standards allow, and what the API can store encrypted. */
  it('accepts an address of 254 characters and refuses one of 255', () => {
    const addressOf = (length: number) => `${'a'.repeat(64)}@${'b'.repeat(length - 72)}.com.br`

    expect(addressOf(254)).toHaveLength(254)
    expect(studentInputSchema.safeParse({ ...filled, email: addressOf(254) }).success).toBe(true)

    const tooLong = studentInputSchema.safeParse({ ...filled, email: addressOf(255) })
    expect(tooLong.success).toBe(false)
    expect(tooLong.success ? [] : tooLong.error.issues.map((issue) => issue.message)).toContain(
      'O e-mail pode ter no máximo 254 caracteres',
    )
  })

  /** The import preview shows these messages line by line, so they cannot be the library's English. */
  it('says in Portuguese when the name or the registration is too long', () => {
    const messagesOf = (input: object) => {
      const result = studentInputSchema.safeParse(input)
      return result.success ? [] : result.error.issues.map((issue) => issue.message)
    }

    expect(studentInputSchema.safeParse({ ...filled, fullName: 'a'.repeat(160) }).success).toBe(true)
    expect(messagesOf({ ...filled, fullName: 'a'.repeat(161) })).toEqual(['O nome pode ter no máximo 160 caracteres'])

    expect(studentInputSchema.safeParse({ ...filled, registration: '1'.repeat(40) }).success).toBe(true)
    expect(messagesOf({ ...filled, registration: '1'.repeat(41) })).toEqual([
      'A matrícula pode ter no máximo 40 caracteres',
    ])
  })

  it('never stores the empty string, so a stored student has an e-mail or none', () => {
    const stored = studentSchema.parse({
      id: 'student-1',
      classId: 'class-1',
      ...filled,
      email: '',
    })

    expect('email' in stored && stored.email).toBeUndefined()
  })
})
