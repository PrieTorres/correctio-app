import { describe, expect, it } from 'vitest'
import { CORRECTION_SOURCE, CORRECTION_STATUS, type Correction, type Question } from '@/types/domain'
import type { SheetImageUpload } from '@/lib/schemas'
import { initialAnswersOf, printedQuestionsOf } from '../review-model'

const OBJECTIVE: Question = {
  id: 'q-objective',
  teacherId: 'ana',
  type: 'objetiva',
  statement: 'Quanto é 2 + 2?',
  tags: [],
  alternatives: [
    { id: 'a-3', text: '3' },
    { id: 'a-4', text: '4' },
    { id: 'a-5', text: '5' },
  ],
  correctAlternativeId: 'a-4',
  allowShuffleAlternatives: true,
}

const OPEN: Question = { id: 'q-open', teacherId: 'ana', type: 'discursiva', statement: 'Explique.', tags: [], maxScore: 2.5, allowShuffleAlternatives: true }

const correction = (overrides: Partial<Correction> = {}): Correction => ({
  id: 'c-1',
  examVersionId: 'v-1',
  answerSheetId: 'sheet-1',
  status: CORRECTION_STATUS.IN_PROGRESS,
  source: CORRECTION_SOURCE.MANUAL,
  objectiveResults: [
    { questionId: 'q-objective', selectedAlternativeId: 'a-5', correct: false, score: 0 },
    { questionId: 'q-blank', correct: false, score: 0 },
  ],
  discursiveScores: [],
  totalScore: 0,
  confirmedAt: '2026-10-30T12:00:00.000Z',
  correctedBy: 'ana',
  isAutomaticallyAssigned: true,
  clientCorrectionId: 'client-1',
  syncStatus: 'synced',
  ...overrides,
})

describe('printedQuestionsOf', () => {
  /** The review follows the paper: a shuffled version puts the open-ended question first and the letters in another order. */
  it('numbers the questions and letters the alternatives as the version printed them', () => {
    const printed = printedQuestionsOf(
      { questionOrder: ['q-open', 'q-objective'], alternativeOrder: [{ questionId: 'q-objective', printedOrder: ['a-5', 'a-3', 'a-4'] }] },
      [OBJECTIVE, OPEN],
    )

    expect(printed.map((entry) => [entry.number, entry.kind])).toEqual([
      [1, 'discursive'],
      [2, 'objective'],
    ])
    expect(printed[0]).toMatchObject({ kind: 'discursive', maxScore: 2.5 })
    const objective = printed[1]
    expect(objective?.kind === 'objective' && objective.alternatives.map((alternative) => `${alternative.letter}=${alternative.text}`)).toEqual([
      'A=5',
      'B=3',
      'C=4',
    ])
  })

  it('keeps the order of the question when the version recorded none for its alternatives', () => {
    const [printed] = printedQuestionsOf({ questionOrder: ['q-objective'], alternativeOrder: [] }, [OBJECTIVE])

    expect(printed?.kind === 'objective' && printed.alternatives.map((alternative) => alternative.letter + alternative.text)).toEqual(['A3', 'B4', 'C5'])
  })

  /** A question missing from the bank is left out rather than guessed, and the numbers keep the paper's. */
  it('leaves out a question it cannot find, keeping the printed numbers of the others', () => {
    const printed = printedQuestionsOf({ questionOrder: ['q-gone', 'q-open'], alternativeOrder: [] }, [OPEN])

    expect(printed.map((entry) => entry.number)).toEqual([2])
  })
})

describe('initialAnswersOf', () => {
  const read: SheetImageUpload = { imageId: 'photo-1', status: 'READ', answerSheetId: 'sheet-1', answers: [{ questionId: 'q-objective', selectedAlternativeId: 'a-4' }] }

  it('starts from the reading of the photo just sent for this sheet', () => {
    expect(initialAnswersOf(read, 'sheet-1', correction())).toEqual(read.answers)
  })

  it('starts from the stored correction when the reading is of another sheet or failed', () => {
    const stored = [{ questionId: 'q-objective', selectedAlternativeId: 'a-5' }, { questionId: 'q-blank' }]

    expect(initialAnswersOf(read, 'sheet-2', correction())).toEqual(stored)
    expect(initialAnswersOf({ imageId: 'photo-2', status: 'READ_FAILED', answerSheetId: 'sheet-1' }, 'sheet-1', correction())).toEqual(stored)
  })

  it('starts blank for a sheet typed by hand (RF30)', () => {
    expect(initialAnswersOf(undefined, 'sheet-1', undefined)).toEqual([])
  })
})
