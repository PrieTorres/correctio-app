import { describe, expect, it } from 'vitest'
import { containsPattern } from '../text-search'

describe('containsPattern', () => {
  it('finds the term anywhere', () => {
    expect(containsPattern('calculo')).toBe('%calculo%')
  })

  it('takes the wildcards the teacher typed literally', () => {
    expect(containsPattern('100%')).toBe('%100!%%')
    expect(containsPattern('turma_a')).toBe('%turma!_a%')
  })

  it('escapes the escape character itself', () => {
    expect(containsPattern('oi!')).toBe('%oi!!%')
  })
})
