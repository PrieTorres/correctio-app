import { describe, expect, it } from 'vitest'
import type { Exam, Question } from '@/types/domain'
import {
  clampDiscursiveScore,
  discursiveQuestionIdsOf,
  gradeObjectives,
  totalCorrectionScore,
} from '../score'

function objective(id: string): Question {
  return {
    id,
    teacherId: 'ana',
    type: 'objetiva',
    statement: `Enunciado ${id}`,
    tags: [],
    alternatives: [
      { id: `${id}-a`, text: 'certa' },
      { id: `${id}-b`, text: 'errada' },
    ],
    correctAlternativeId: `${id}-a`,
    allowShuffleAlternatives: true,
  }
}

function discursive(id: string): Question {
  return {
    id,
    teacherId: 'ana',
    type: 'discursiva',
    statement: `Enunciado ${id}`,
    tags: [],
    maxScore: 4,
    allowShuffleAlternatives: true,
  }
}

const BANK = [objective('q1'), objective('q2'), discursive('q3')]

function exam(scores: Record<string, number> = {}): Exam {
  return {
    id: 'exam-1',
    teacherId: 'ana',
    title: 'Prova',
    description: '',
    status: 'ready',
    defaultShuffleQuestions: true,
    defaultShuffleAlternatives: true,
    questions: BANK.map((question, index) => ({
      questionId: question.id,
      order: index,
      score: scores[question.id] ?? 3,
      allowShuffleAlternatives: true,
    })),
  }
}

describe('gradeObjectives', () => {
  it('gives the question score for the right alternative', () => {
    const { results, score } = gradeObjectives(exam(), BANK, [
      { questionId: 'q1', selectedAlternativeId: 'q1-a' },
    ])

    expect(results.find((item) => item.questionId === 'q1')?.correct).toBe(true)
    expect(score).toBe(3)
  })

  it('gives nothing for the wrong alternative', () => {
    const { results, score } = gradeObjectives(exam(), BANK, [
      { questionId: 'q1', selectedAlternativeId: 'q1-b' },
    ])

    expect(results.find((item) => item.questionId === 'q1')?.correct).toBe(false)
    expect(score).toBe(0)
  })

  /** A blank answer is wrong, not absent: the total has to match the paper. */
  it('counts a question left blank as wrong, and still reports it', () => {
    const { results } = gradeObjectives(exam(), BANK, [])

    const blank = results.find((item) => item.questionId === 'q1')
    expect(blank?.correct).toBe(false)
    expect(blank?.selectedAlternativeId).toBeUndefined()
  })

  it('records which alternative was marked, for the review screen', () => {
    const { results } = gradeObjectives(exam(), BANK, [
      { questionId: 'q1', selectedAlternativeId: 'q1-b' },
    ])

    expect(results.find((item) => item.questionId === 'q1')?.selectedAlternativeId).toBe('q1-b')
  })

  it('leaves the open-ended questions out, since they have no right answer', () => {
    const { results } = gradeObjectives(exam(), BANK, [])

    expect(results.map((item) => item.questionId)).toEqual(['q1', 'q2'])
  })

  it('uses the score the exam gives, not one the question carries', () => {
    const { score } = gradeObjectives(exam({ q1: 7 }), BANK, [
      { questionId: 'q1', selectedAlternativeId: 'q1-a' },
    ])

    expect(score).toBe(7)
  })

  it('ignores an answer to a question that is not in the exam', () => {
    const { results } = gradeObjectives(exam(), BANK, [
      { questionId: 'ghost', selectedAlternativeId: 'x' },
    ])

    expect(results.map((item) => item.questionId)).toEqual(['q1', 'q2'])
  })

  it('skips a question whose entry points outside the bank', () => {
    const withGhost = { ...exam() }
    withGhost.questions = [
      ...withGhost.questions,
      { questionId: 'missing', order: 9, score: 5, allowShuffleAlternatives: true },
    ]

    const { results } = gradeObjectives(withGhost, BANK, [])

    expect(results.map((item) => item.questionId)).toEqual(['q1', 'q2'])
  })

  it('adds up every right answer', () => {
    const { score } = gradeObjectives(exam(), BANK, [
      { questionId: 'q1', selectedAlternativeId: 'q1-a' },
      { questionId: 'q2', selectedAlternativeId: 'q2-a' },
    ])

    expect(score).toBe(6)
  })

  it('scores an exam with nothing in it as zero', () => {
    const empty = { ...exam(), questions: [] }

    expect(gradeObjectives(empty, BANK, []).score).toBe(0)
  })

  it('does not leak the floating point tail into the total', () => {
    const { score } = gradeObjectives(exam({ q1: 3.33, q2: 3.34 }), BANK, [
      { questionId: 'q1', selectedAlternativeId: 'q1-a' },
      { questionId: 'q2', selectedAlternativeId: 'q2-a' },
    ])

    expect(score).toBe(6.67)
  })
})

describe('totalCorrectionScore', () => {
  it('adds what the machine graded to what the teacher gave', () => {
    const objectives = [{ questionId: 'q1', correct: true, score: 3 }]
    const discursives = [{ questionId: 'q3', score: 2.5 }]

    expect(totalCorrectionScore(objectives, discursives)).toBe(5.5)
  })

  it('is zero when nothing was scored', () => {
    expect(totalCorrectionScore([], [])).toBe(0)
  })

  /** Zero is a mark the teacher gave, not a mark that is missing. */
  it('counts a deliberate zero', () => {
    expect(totalCorrectionScore([], [{ questionId: 'q3', score: 0 }])).toBe(0)
  })

  it('does not leak the floating point tail', () => {
    expect(
      totalCorrectionScore([], [
        { questionId: 'a', score: 3.33 },
        { questionId: 'b', score: 3.33 },
        { questionId: 'c', score: 3.34 },
      ]),
    ).toBe(10)
  })
})

describe('discursiveQuestionIdsOf', () => {
  it('lists the open-ended questions in the exam order', () => {
    expect(discursiveQuestionIdsOf(exam(), BANK)).toEqual(['q3'])
  })

  it('lists none for an exam made only of multiple choice', () => {
    const onlyObjective = {
      ...exam(),
      questions: exam().questions.filter((entry) => entry.questionId !== 'q3'),
    }

    expect(discursiveQuestionIdsOf(onlyObjective, BANK)).toEqual([])
  })
})

describe('clampDiscursiveScore', () => {
  it('keeps a score inside what the question is worth', () => {
    expect(clampDiscursiveScore(12, 10)).toBe(10)
  })

  it('leaves a score that already fits', () => {
    expect(clampDiscursiveScore(7.5, 10)).toBe(7.5)
  })

  it('treats a negative mark as zero', () => {
    expect(clampDiscursiveScore(-3, 10)).toBe(0)
  })

  it('treats nothing typed as zero rather than as not a number', () => {
    expect(clampDiscursiveScore(Number.NaN, 10)).toBe(0)
  })
})
