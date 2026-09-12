import { describe, expect, it } from 'vitest'
import { fieldArrayMessage } from '../field-array-error'

describe('fieldArrayMessage', () => {
  /** Where the message lands once the array items are registered. */
  it('reads the message under root', () => {
    expect(fieldArrayMessage({ root: { message: 'Preencha tudo', type: 'custom' } })).toBe(
      'Preencha tudo',
    )
  })

  /** Where it lands before any item is registered. */
  it('reads the message on the field itself', () => {
    expect(fieldArrayMessage({ message: 'Preencha tudo', type: 'custom' })).toBe('Preencha tudo')
  })

  it('prefers root when both are there', () => {
    expect(fieldArrayMessage({ message: 'antiga', root: { message: 'atual' } })).toBe('atual')
  })

  it('reports nothing when there is no error', () => {
    expect(fieldArrayMessage(undefined)).toBeUndefined()
    expect(fieldArrayMessage(null)).toBeUndefined()
  })

  it('reports nothing for an error that carries no message', () => {
    expect(fieldArrayMessage({ type: 'custom' })).toBeUndefined()
    expect(fieldArrayMessage({ root: {} })).toBeUndefined()
  })

  it('ignores a message that is not text', () => {
    expect(fieldArrayMessage({ message: 42 })).toBeUndefined()
  })
})
