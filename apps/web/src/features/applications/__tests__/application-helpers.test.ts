import { describe, expect, it } from 'vitest'
import { examTitleOf, shuffleOf, sittingOf } from '../application-labels'
import { fromDetailOf, returnPathFrom } from '../generation-origin'
import { versionShufflesOf, withChange, withinCount } from '../version-shuffles'

const SHUFFLE_BOTH = { shuffleQuestions: true, shuffleAlternatives: true }

describe('application labels', () => {
  it('names the class and the day of a sitting, and says when the class is gone', () => {
    expect(sittingOf({ className: 'Turma A', date: '2026-10-05T12:00:00.000Z' })).toBe('Turma A · 05/10/2026')
    expect(sittingOf({ className: '', date: '2026-10-05T12:00:00.000Z' })).toBe('Turma removida · 05/10/2026')
  })

  it('says when the exam is gone', () => {
    expect(examTitleOf({ examTitle: 'Cálculo I — P1' })).toBe('Cálculo I — P1')
    expect(examTitleOf({ examTitle: '' })).toBe('Prova removida')
  })

  it('describes what a version did with the order of the exam', () => {
    expect(shuffleOf(SHUFFLE_BOTH)).toBe('Questões embaralhadas · alternativas embaralhadas')
    expect(shuffleOf({ shuffleQuestions: false, shuffleAlternatives: false })).toBe('Questões na ordem da prova · alternativas na ordem')
  })
})

describe('generation origin', () => {
  it('goes back to the detail the generation started on', () => {
    expect(returnPathFrom(fromDetailOf('a1'))).toBe('/aplicacoes/a1')
  })

  /** The state comes from the browser history, which anything could have written. */
  it('goes back to the list from anywhere else, or from a state that is not a path of the applications', () => {
    expect(returnPathFrom(undefined)).toBe('/aplicacoes')
    expect(returnPathFrom({ returnTo: 'https://exemplo.com' })).toBe('/aplicacoes')
    expect(returnPathFrom({ returnTo: '/turmas/t1' })).toBe('/aplicacoes')
    expect(returnPathFrom({ returnTo: 42 })).toBe('/aplicacoes')
  })
})

describe('version shuffles', () => {
  const preferences = { shuffleQuestions: true, shuffleAlternatives: false }

  it('starts every version from the preferences of the exam (RF17)', () => {
    expect(versionShufflesOf(2, preferences, {})).toEqual([preferences, preferences])
  })

  it('keeps what was switched on one version without touching the others (RF22)', () => {
    const changes = withChange(withChange({}, 1, { shuffleAlternatives: true }), 1, { shuffleQuestions: false })

    expect(versionShufflesOf(3, preferences, changes)).toEqual([
      preferences,
      { shuffleQuestions: false, shuffleAlternatives: true },
      preferences,
    ])
  })

  it('forgets a removed version, which starts from the preferences again when added back', () => {
    const changes = withinCount(withChange({}, 2, { shuffleQuestions: false }), 2)

    expect(versionShufflesOf(3, preferences, changes)[2]).toEqual(preferences)
  })
})
