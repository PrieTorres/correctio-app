import { describe, expect, it } from 'vitest'
import { compareByLocale, matchesSearch, normalize } from '../text'

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

describe('normalize, accents', () => {
  it('folds an accent to its plain letter', () => {
    expect(normalize('Cálculo')).toBe('calculo')
  })

  it('handles the tilde and the cedilla, which Portuguese leans on', () => {
    expect(normalize('Composição')).toBe('composicao')
  })

  it('leaves a word with no accent alone', () => {
    expect(normalize('Matrizes')).toBe('matrizes')
  })
})

describe('matchesSearch, accents', () => {
  it('finds an accented title typed without accents', () => {
    expect(matchesSearch('calculo', 'Cálculo I — Noturno')).toBe(true)
  })

  it('finds an unaccented title typed with accents', () => {
    expect(matchesSearch('matemática', 'Matematica aplicada')).toBe(true)
  })

  it('still refuses a term that is simply not there', () => {
    expect(matchesSearch('física', 'Cálculo I')).toBe(false)
  })
})
