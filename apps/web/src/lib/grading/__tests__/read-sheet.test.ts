import { describe, expect, it } from 'vitest'
import type { ExamVersion, Question } from '@/types/domain'
import { readSheet } from '../read-sheet'

function objective(id: string): Question {
  return {
    id,
    teacherId: 'ana',
    type: 'objetiva',
    statement: id,
    tags: [],
    alternatives: [
      { id: `${id}-a`, text: 'certa' },
      { id: `${id}-b`, text: 'errada' },
      { id: `${id}-c`, text: 'outra' },
    ],
    correctAlternativeId: `${id}-a`,
    allowShuffleAlternatives: true,
  }
}

const DISCURSIVE: Question = {
  id: 'q3',
  teacherId: 'ana',
  type: 'discursiva',
  statement: 'q3',
  tags: [],
  maxScore: 4,
  allowShuffleAlternatives: true,
}

const BANK = [objective('q1'), objective('q2'), DISCURSIVE]


const VERSION: ExamVersion = {
  id: 'version-1',
  applicationId: 'app-1',
  versionNumber: 1,
  shuffleQuestions: false,
  shuffleAlternatives: false,
  withStudentIdentification: true,
  layout: { questionOrder: ['q1', 'q2', 'q3'], alternativeOrder: [] },
  answerKeyPublished: false,
  publicCode: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  qrCodePayload: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
}

/** Below the blank threshold, so every question comes back unanswered. */
const alwaysBlank = () => 0.05
/** Between blank and wrong, so every question comes back right. */
const alwaysRight = () => 0.5
/** Above the wrong threshold, taking the first wrong alternative. */
const alwaysWrong = () => 0.9

describe('readSheet', () => {
  it('reads one answer per multiple-choice question', () => {
    expect(readSheet(VERSION, BANK, alwaysRight)).toHaveLength(2)
  })

  it('leaves the open-ended questions out, since there is nothing to mark', () => {
    const answers = readSheet(VERSION, BANK, alwaysRight)

    expect(answers.map((item) => item.questionId)).not.toContain('q3')
  })

  it('can read the right alternative', () => {
    const answers = readSheet(VERSION, BANK, alwaysRight)

    expect(answers[0]?.selectedAlternativeId).toBe('q1-a')
  })

  it('can read a wrong alternative, which is what the review is for', () => {
    const answers = readSheet(VERSION, BANK, alwaysWrong)

    expect(answers[0]?.selectedAlternativeId).not.toBe('q1-a')
    expect(answers[0]?.selectedAlternativeId).toBeDefined()
  })

  it('can read a question as blank', () => {
    const answers = readSheet(VERSION, BANK, alwaysBlank)

    expect(answers[0]?.selectedAlternativeId).toBeUndefined()
    expect(answers).toHaveLength(2)
  })

  it('follows the printed order rather than the exam order', () => {
    const reversed = { ...VERSION, layout: { ...VERSION.layout, questionOrder: ['q2', 'q1'] } }

    expect(readSheet(reversed, BANK, alwaysRight).map((item) => item.questionId)).toEqual([
      'q2',
      'q1',
    ])
  })

  it('skips a question that is no longer in the bank', () => {
    const ghost = { ...VERSION, layout: { ...VERSION.layout, questionOrder: ['q1', 'missing'] } }

    expect(readSheet(ghost, BANK, alwaysRight)).toHaveLength(1)
  })

  it('reads nothing from a version that printed nothing', () => {
    const empty = { ...VERSION, layout: { questionOrder: [], alternativeOrder: [] } }

    expect(readSheet(empty, BANK, alwaysRight)).toEqual([])
  })
})
