import { describe, expect, it } from 'vitest'
import { compareByLocale, excerpt, firstName, matchesSearch, normalize } from '../text'

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

describe('firstName', () => {
  it('takes the first word of a full name', () => {
    expect(firstName('Ana Clara Ribeiro')).toBe('Ana')
  })

  it('ignores the whitespace around and between the words', () => {
    expect(firstName('  Ana   Ribeiro ')).toBe('Ana')
  })

  /** The greeting falls back to "Olá!" on an empty result, so nothing here may throw or invent a name. */
  it('answers with nothing when there is no name', () => {
    expect(firstName(undefined)).toBe('')
    expect(firstName('')).toBe('')
    expect(firstName('   ')).toBe('')
  })
})

describe('excerpt', () => {
  it('keeps a short text whole', () => {
    expect(excerpt('A derivada de f(x) = x³ é:')).toBe('A derivada de f(x) = x³ é:')
  })

  it('cuts a long text at a word and says there is more', () => {
    const statement = 'Explique com suas palavras o que significa dizer que uma função é contínua em um ponto.'

    expect(excerpt(statement)).toBe('Explique com suas palavras o que significa dizer que uma…')
    expect(excerpt(statement).length).toBeLessThanOrEqual(61)
  })

  it('folds line breaks and repeated spaces into one space', () => {
    expect(excerpt('Primeira linha\n\n  segunda linha')).toBe('Primeira linha segunda linha')
  })

  it('drops the punctuation left before the ellipsis', () => {
    expect(excerpt('Calcule, sem calculadora, o valor de', 10)).toBe('Calcule…')
  })

  it('cuts inside a word only when the first word alone is too long', () => {
    expect(excerpt('Pneumoultramicroscopicossilicovulcanoconiótico', 10)).toBe('Pneumoultr…')
  })
})
