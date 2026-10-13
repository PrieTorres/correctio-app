import { describe, expect, it } from 'vitest'
import { isMultipleChoice, isOpenEnded, type Question } from '../domain'

const base: Question = {
  id: 'q1',
  teacherId: 't1',
  type: 'objetiva',
  statement: 'Quanto é 2 + 2?',
  tags: [],
  allowShuffleAlternatives: true,
}

describe('question predicates', () => {
  it('recognises a multiple-choice question by its alternatives', () => {
    const multipleChoice: Question = { ...base, alternatives: [{ id: 'a', text: '4' }], correctAlternativeId: 'a' }

    expect(isMultipleChoice(multipleChoice)).toBe(true)
    expect(isOpenEnded(multipleChoice)).toBe(false)
  })

  it('recognises an open-ended question by its maximum score', () => {
    const openEnded: Question = { ...base, type: 'discursiva', maxScore: 2 }

    expect(isOpenEnded(openEnded)).toBe(true)
    expect(isMultipleChoice(openEnded)).toBe(false)
  })

  it('does not narrow a question missing the field its type needs', () => {
    expect(isMultipleChoice(base)).toBe(false)
    expect(isOpenEnded({ ...base, type: 'discursiva' })).toBe(false)
  })
})
