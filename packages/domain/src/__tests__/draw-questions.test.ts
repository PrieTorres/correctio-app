import { describe, expect, it } from 'vitest'
import type { Question } from '../domain'
import { distributeScore, drawQuestions, redrawQuestion } from '../draw-questions'

function multipleChoice(id: string, tags: string[] = []): Question {
  return {
    id,
    teacherId: 'ana',
    type: 'objetiva',
    statement: `Enunciado ${id}`,
    tags,
    alternatives: [
      { id: `${id}-a`, text: 'uma' },
      { id: `${id}-b`, text: 'outra' },
    ],
    correctAlternativeId: `${id}-a`,
    allowShuffleAlternatives: true,
  }
}

function openEnded(id: string, tags: string[] = []): Question {
  return {
    id,
    teacherId: 'ana',
    type: 'discursiva',
    statement: `Enunciado ${id}`,
    tags,
    maxScore: 2,
    allowShuffleAlternatives: true,
  }
}

/** Always takes the first of whatever remains, so the draw is an assertion. */
const takeFirst = () => 0

describe('drawQuestions', () => {
  const bank = [
    multipleChoice('mc1', ['Limites']),
    multipleChoice('mc2', ['Limites', 'Cálculo']),
    multipleChoice('mc3', ['Matrizes']),
    openEnded('oe1', ['Limites']),
    openEnded('oe2', ['Matrizes']),
  ]

  it('draws the requested count of each type', () => {
    const result = drawQuestions(bank, { tags: [], multipleChoiceCount: 2, openEndedCount: 1 })

    expect(result.questions.filter((item) => item.type === 'objetiva')).toHaveLength(2)
    expect(result.questions.filter((item) => item.type === 'discursiva')).toHaveLength(1)
    expect(result.shortfall).toBeNull()
  })

  it('never repeats a question', () => {
    const result = drawQuestions(bank, { tags: [], multipleChoiceCount: 3, openEndedCount: 2 })

    const ids = result.questions.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  /** More tags widen the draw: a question needs one of them, not all, or two tags would empty the bank. */
  it('keeps the questions carrying any of the tags asked for', () => {
    const result = drawQuestions(
      bank,
      { tags: ['Cálculo', 'Matrizes'], multipleChoiceCount: 5, openEndedCount: 5 },
      takeFirst,
    )

    expect(result.questions.map((item) => item.id).sort()).toEqual(['mc2', 'mc3', 'oe2'])
  })

  it('leaves out a question with none of the tags asked for', () => {
    const result = drawQuestions(bank, { tags: ['Cálculo'], multipleChoiceCount: 5, openEndedCount: 5 }, takeFirst)

    expect(result.questions.map((item) => item.id)).toEqual(['mc2'])
  })

  it('takes anything when no tag is given', () => {
    const result = drawQuestions(bank, { tags: [], multipleChoiceCount: 3, openEndedCount: 0 })

    expect(result.questions).toHaveLength(3)
  })

  it('leaves out a question that was deleted from the bank', () => {
    const withDeleted = [...bank, { ...multipleChoice('mc4'), deletedAt: '2026-01-01T00:00:00.000Z' }]

    const result = drawQuestions(withDeleted, {
      tags: [],
      multipleChoiceCount: 10,
      openEndedCount: 0,
    })

    expect(result.questions.map((item) => item.id)).not.toContain('mc4')
  })

  it('reports what was missing instead of failing', () => {
    const result = drawQuestions(bank, { tags: [], multipleChoiceCount: 5, openEndedCount: 4 })

    expect(result.shortfall).toEqual({ multipleChoice: 2, openEnded: 2 })
  })

  it('still returns what it found when the bank falls short', () => {
    const result = drawQuestions(bank, { tags: [], multipleChoiceCount: 5, openEndedCount: 4 })

    expect(result.questions).toHaveLength(5)
  })

  it('asking for none of a type draws none of it', () => {
    const result = drawQuestions(bank, { tags: [], multipleChoiceCount: 2, openEndedCount: 0 })

    expect(result.questions.every((item) => item.type === 'objetiva')).toBe(true)
    expect(result.shortfall).toBeNull()
  })

  it('draws nothing from an empty bank, and says so', () => {
    const result = drawQuestions([], { tags: [], multipleChoiceCount: 2, openEndedCount: 0 })

    expect(result.questions).toHaveLength(0)
    expect(result.shortfall).toEqual({ multipleChoice: 2, openEnded: 0 })
  })
})

describe('redrawQuestion', () => {
  const bank = [
    multipleChoice('mc1', ['Limites']),
    multipleChoice('mc2', ['Limites']),
    openEnded('oe1', ['Limites']),
  ]

  it('replaces with another of the same type', () => {
    const replacement = redrawQuestion(bank, { tags: [], alreadyChosenIds: ['mc1'], replacing: bank[0] as never }, takeFirst)

    expect(replacement?.id).toBe('mc2')
  })

  it('never offers one already in the draw', () => {
    const replacement = redrawQuestion(bank, { tags: [], alreadyChosenIds: ['mc1', 'mc2'], replacing: bank[0] as never })

    expect(replacement).toBeNull()
  })

  it('says nothing is left rather than repeating the same question', () => {
    const replacement = redrawQuestion([multipleChoice('only')], {
      tags: [],
      alreadyChosenIds: ['only'],
      replacing: multipleChoice('only'),
    })

    expect(replacement).toBeNull()
  })

  it('honours the tag filter when replacing', () => {
    const replacement = redrawQuestion(bank, { tags: ['Matrizes'], alreadyChosenIds: [], replacing: bank[0] as never })

    expect(replacement).toBeNull()
  })
})

describe('distributeScore', () => {
  it('splits evenly when it divides', () => {
    expect(distributeScore(10, 5)).toEqual([2, 2, 2, 2, 2])
  })

  it('gives the remainder to the first question, so the parts add up', () => {
    const scores = distributeScore(10, 3)

    expect(scores).toEqual([3.34, 3.33, 3.33])
    expect(scores.reduce((sum, score) => sum + score, 0)).toBeCloseTo(10, 5)
  })

  it('returns nothing for no questions, rather than dividing by zero', () => {
    expect(distributeScore(10, 0)).toEqual([])
    expect(distributeScore(10, -1)).toEqual([])
  })
})

describe('drawQuestions balanced over the tags asked', () => {
  const tagged = (prefix: string, tag: string, count: number, make = multipleChoice) =>
    Array.from({ length: count }, (_, index) => make(`${prefix}${index + 1}`, [tag]))

  /** The tag with the most questions does not crowd out the others: each content gets one before any gets two. */
  it('covers every tag asked before giving any of them a second question', () => {
    const bank = [...tagged('lim', 'Limites', 5), ...tagged('der', 'Derivadas', 1), ...tagged('int', 'Integrais', 1)]

    const result = drawQuestions(bank, { tags: ['Limites', 'Derivadas', 'Integrais'], multipleChoiceCount: 3, openEndedCount: 0 }, takeFirst)

    expect(result.questions.map((item) => item.tags[0]).sort()).toEqual(['Derivadas', 'Integrais', 'Limites'])
  })

  it('splits the questions evenly between the tags while the bank allows', () => {
    const bank = [...tagged('lim', 'Limites', 4), ...tagged('mat', 'Matrizes', 4)]

    const result = drawQuestions(bank, { tags: ['Limites', 'Matrizes'], multipleChoiceCount: 4, openEndedCount: 0 }, takeFirst)

    const perTag = result.questions.map((item) => item.tags[0])
    expect(perTag.filter((tag) => tag === 'Limites')).toHaveLength(2)
    expect(perTag.filter((tag) => tag === 'Matrizes')).toHaveLength(2)
  })

  it('fills from the tags that still have questions once a tag runs out', () => {
    const bank = [...tagged('lim', 'Limites', 4), ...tagged('mat', 'Matrizes', 1)]

    const result = drawQuestions(bank, { tags: ['Limites', 'Matrizes'], multipleChoiceCount: 4, openEndedCount: 0 }, takeFirst)

    expect(result.questions).toHaveLength(4)
    expect(result.questions.filter((item) => item.tags.includes('Matrizes'))).toHaveLength(1)
    expect(result.shortfall).toBeNull()
  })

  /** The open-ended questions go on from what the multiple-choice ones covered. */
  it('draws the open-ended questions from the contents the multiple-choice ones left out', () => {
    const bank = [multipleChoice('mc-lim', ['Limites']), openEnded('oe-lim', ['Limites']), openEnded('oe-mat', ['Matrizes'])]

    const result = drawQuestions(bank, { tags: ['Limites', 'Matrizes'], multipleChoiceCount: 1, openEndedCount: 1 }, takeFirst)

    expect(result.questions.map((item) => item.id)).toEqual(['mc-lim', 'oe-mat'])
  })

  it('counts a question for every asked tag it carries', () => {
    const bank = [multipleChoice('both', ['Limites', 'Matrizes']), ...tagged('lim', 'Limites', 2), ...tagged('mat', 'Matrizes', 2)]

    const result = drawQuestions(bank, { tags: ['Limites', 'Matrizes'], multipleChoiceCount: 3, openEndedCount: 0 }, takeFirst)

    const count = (tag: string) => result.questions.filter((item) => item.tags.includes(tag)).length
    expect(Math.abs(count('Limites') - count('Matrizes'))).toBeLessThanOrEqual(1)
  })
})
