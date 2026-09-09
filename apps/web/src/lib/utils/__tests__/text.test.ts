import { describe, expect, it } from 'vitest'
import { compareByLocale, matchesSearch } from '../text'

describe('matchesSearch', () => {
  it('matches every record when the term is blank', () => {
    expect(matchesSearch('', 'anything')).toBe(true)
    expect(matchesSearch('   ', 'anything')).toBe(true)
  })

  it('ignores case and surrounding whitespace', () => {
    expect(matchesSearch('  CÁLCULO ', 'Cálculo I')).toBe(true)
  })

  it('looks across every field it is given', () => {
    expect(matchesSearch('física', 'Turma A', 'Física')).toBe(true)
    expect(matchesSearch('química', 'Turma A', 'Física')).toBe(false)
  })
})

describe('compareByLocale', () => {
  it('sorts accented names in the expected Portuguese order', () => {
    expect(['Ícaro', 'Ana', 'Éder'].toSorted(compareByLocale)).toEqual(['Ana', 'Éder', 'Ícaro'])
  })
})
