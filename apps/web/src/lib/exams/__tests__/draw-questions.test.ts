import { describe, expect, it } from 'vitest'
import type { Question } from '@/types/domain'
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

  it('keeps only questions carrying every tag asked for', () => {
    const result = drawQuestions(
      bank,
      { tags: ['Limites', 'Cálculo'], multipleChoiceCount: 5, openEndedCount: 5 },
      takeFirst,
    )

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
    const replacement = redrawQuestion(bank, { tags: [] }, ['mc1'], bank[0] as never, takeFirst)

    expect(replacement?.id).toBe('mc2')
  })

  it('never offers one already in the draw', () => {
    const replacement = redrawQuestion(bank, { tags: [] }, ['mc1', 'mc2'], bank[0] as never)

    expect(replacement).toBeNull()
  })

  it('says nothing is left rather than repeating the same question', () => {
    const replacement = redrawQuestion(
      [multipleChoice('only')],
      { tags: [] },
      ['only'],
      multipleChoice('only'),
    )

    expect(replacement).toBeNull()
  })

  it('honours the tag filter when replacing', () => {
    const replacement = redrawQuestion(bank, { tags: ['Matrizes'] }, [], bank[0] as never)

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
