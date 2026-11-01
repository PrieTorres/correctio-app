import { describe, expect, it } from 'vitest'
import { answerKeyBadgeOf, correctionBadgeOf, correctionBlockerOf, examTitleOf, shuffleOf, sittingOf } from '../application-labels'
import { fromDetailOf, returnPathFrom } from '../generation-origin'
import { versionShufflesOf, withChange, withinCount } from '../version-shuffles'

const SHUFFLE_BOTH = { shuffleQuestions: true, shuffleAlternatives: true }

describe('application labels', () => {
  /** The three stages P11 filters by, as P5 names them on each application of the class (#144). */
  it('names where the correction stands', () => {
    expect(correctionBadgeOf({ corrections: 0, correctedSheets: 0 }).label).toBe('Correção não iniciada')
    expect(correctionBadgeOf({ corrections: 3, correctedSheets: 2 })).toEqual({ label: 'Correção em andamento', tone: 'warning' })
    expect(correctionBadgeOf({ corrections: 2, correctedSheets: 2 })).toEqual({ label: 'Correção concluída', tone: 'success' })
  })

  it('names the class and the day of a sitting, and says when the class is gone', () => {
    expect(sittingOf({ className: 'Turma A', date: '2026-10-05T12:00:00.000Z' })).toBe('Turma A · 05/10/2026')
    expect(sittingOf({ className: '', date: '2026-10-05T12:00:00.000Z' })).toBe('Turma removida · 05/10/2026')
  })

  it('says when the exam is gone', () => {
    expect(examTitleOf({ examTitle: 'Cálculo I — P1' })).toBe('Cálculo I — P1')
    expect(examTitleOf({ examTitle: '' })).toBe('Prova removida')
  })

  /** P11 shows whether the students can see the key; before the paper exists there is nothing to say. */
  it('says whether the answer keys were published, and how far a partial publication went', () => {
    expect(answerKeyBadgeOf({ versions: 0, publishedAnswerKeys: 0 })).toBeNull()
    expect(answerKeyBadgeOf({ versions: 2, publishedAnswerKeys: 0 })).toEqual({ label: 'Gabarito não publicado', tone: 'neutral' })
    expect(answerKeyBadgeOf({ versions: 3, publishedAnswerKeys: 1 })).toEqual({
      label: 'Gabarito publicado em 1 de 3 versões',
      tone: 'warning',
    })
    expect(answerKeyBadgeOf({ versions: 2, publishedAnswerKeys: 2 })).toEqual({ label: 'Gabarito publicado', tone: 'success' })
  })

  it('blocks the correction only while there is no sheet to correct', () => {
    expect(correctionBlockerOf({ progress: { versions: 0, publishedAnswerKeys: 0, sheets: 0, correctedSheets: 0, corrections: 0 } })).toBe(
      'Gere o PDF antes de corrigir as folhas.',
    )
    expect(correctionBlockerOf({ progress: { versions: 1, publishedAnswerKeys: 0, sheets: 12, correctedSheets: 0, corrections: 0 } })).toBeUndefined()
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
