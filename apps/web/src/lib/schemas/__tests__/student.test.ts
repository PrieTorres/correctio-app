import { describe, expect, it } from 'vitest'
import { studentInputSchema, studentSchema } from '../index'

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
