import { describe, expect, it } from 'vitest'
import { collationKey, distinctTags, hasTag } from '../collation'

describe('collationKey', () => {
  it('drops case and accents, as utf8mb4_0900_ai_ci compares', () => {
    expect(collationKey('Matemática')).toBe(collationKey('MATEMATICA'))
    expect(collationKey('Cálculo')).not.toBe(collationKey('Calculo I'))
  })
})

describe('hasTag', () => {
  it('finds a tag in any spelling the database takes as the same', () => {
    expect(hasTag(['matematica', 'Física'], 'Matemática')).toBe(true)
    expect(hasTag(['Física'], 'FISICA')).toBe(true)
  })

  it('does not find a different tag', () => {
    expect(hasTag(['Matemática financeira'], 'Matemática')).toBe(false)
    expect(hasTag([], 'Matemática')).toBe(false)
  })
})

describe('distinctTags', () => {
  it('keeps each tag once, under the first spelling given', () => {
    expect(distinctTags(['Matemática', 'Física', 'matematica', 'FÍSICA', 'Química'])).toEqual(['Matemática', 'Física', 'Química'])
  })
})
