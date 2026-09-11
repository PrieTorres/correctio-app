import { describe, expect, it } from 'vitest'
import { totalScore } from '../score'

const question = (score: number) => ({
  questionId: `q${score}`,
  order: 0,
  score,
  allowShuffleAlternatives: true,
})

describe('totalScore', () => {
  it('is zero for an exam with no questions', () => {
    expect(totalScore([])).toBe(0)
  })

  it('adds the scores', () => {
    expect(totalScore([question(2), question(3)])).toBe(5)
  })

  it('does not leak the floating point tail onto the screen', () => {
    expect(totalScore([question(3.33), question(3.33), question(3.34)])).toBe(10)
  })

  it('does not force the total to ten, since the teacher decides that', () => {
    expect(totalScore([question(2), question(2)])).toBe(4)
  })
})
