import { ANSWER_CARD } from '@correctio/domain'
import { answersOf, type MarkedAnswer } from '@/lib/grading'
import {
  isMultipleChoice,
  type Alternative,
  type Correction,
  type ExamVersionLayout,
  type MultipleChoiceQuestion,
  type Question,
} from '@/types/domain'
import type { SheetImageUpload } from '@/lib/schemas'

/** The search parameter that names the photo a review is made from (#48), kept in the address so a reload keeps it. */
export const PHOTO_PARAM = 'foto'

/** An alternative with the letter the paper printed beside its bubble. */
export interface PrintedAlternative extends Alternative {
  letter: string
}

/** A question as the sheet of one version prints it: its number on the paper and, for an objective one, its letters. */
export type PrintedQuestion =
  | { kind: 'objective'; number: number; question: MultipleChoiceQuestion; alternatives: PrintedAlternative[] }
  | { kind: 'discursive'; number: number; question: Question; maxScore: number }

function printedAlternatives(question: MultipleChoiceQuestion, printedOrder: readonly string[] | undefined): PrintedAlternative[] {
  const byId = new Map(question.alternatives.map((alternative) => [alternative.id, alternative]))
  const order = printedOrder ?? question.alternatives.map((alternative) => alternative.id)
  return order.flatMap((id, position) => {
    const alternative = byId.get(id)
    return alternative === undefined ? [] : [{ ...alternative, letter: ANSWER_CARD.columns[position] ?? '?' }]
  })
}

/**
 * The questions in the order the sheet of this version printed them, each
 * objective one with its letters in the printed order (#48). A shuffled
 * version puts both in another order than the exam, and a review in the
 * exam's order would have the teacher compare the photo with the wrong
 * letters. A question missing from the bank is left out rather than guessed.
 */
export function printedQuestionsOf(layout: ExamVersionLayout, bank: readonly Question[]): PrintedQuestion[] {
  const byId = new Map(bank.map((question) => [question.id, question]))
  const printedOrderOf = new Map(layout.alternativeOrder.map((entry) => [entry.questionId, entry.printedOrder]))

  return layout.questionOrder.flatMap((questionId, index): PrintedQuestion[] => {
    const question = byId.get(questionId)
    if (question === undefined) return []
    const number = index + 1
    if (!isMultipleChoice(question)) return [{ kind: 'discursive', number, question, maxScore: question.maxScore ?? 0 }]
    return [{ kind: 'objective', number, question, alternatives: printedAlternatives(question, printedOrderOf.get(questionId)) }]
  })
}

/**
 * Where the review of a sheet starts: the reading of the photo just sent, when
 * it is of this sheet; otherwise the correction already stored; otherwise
 * blank, for a sheet typed by hand (RF30) or a photo whose marks were not read.
 */
export function initialAnswersOf(reading: SheetImageUpload | undefined, sheetId: string, correction: Correction | undefined): MarkedAnswer[] {
  if (reading?.status === 'READ' && reading.answerSheetId === sheetId) return reading.answers
  return correction === undefined ? [] : answersOf(correction)
}
