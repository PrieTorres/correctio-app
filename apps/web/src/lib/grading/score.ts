import type { DiscursiveScore, Exam, ObjectiveResult, Question } from '@/types/domain'

export interface MarkedAnswer {
  questionId: string
  /** Absent when the student left it blank or the reading could not tell. */
  selectedAlternativeId?: string
}

export interface GradedObjectives {
  results: ObjectiveResult[]
  score: number
}

/**
 * Grades the multiple-choice questions of one sheet.
 *
 * A blank answer is wrong, not absent: leaving a question unanswered is a
 * decision with the same consequence as answering it incorrectly, and a
 * correction that silently skipped it would report a total nobody can check
 * against the paper.
 *
 * Scores come from the exam rather than the question, because the same question
 * can be worth different points in different exams.
 */
export function gradeObjectives(
  exam: Exam,
  bank: readonly Question[],
  answers: readonly MarkedAnswer[],
): GradedObjectives {
  const byId = new Map(bank.map((question) => [question.id, question]))
  const marked = new Map(answers.map((answer) => [answer.questionId, answer.selectedAlternativeId]))

  const results = exam.questions.flatMap((entry): ObjectiveResult[] => {
    const question = byId.get(entry.questionId)
    if (question === undefined || question.type !== 'objetiva') return []

    const selectedAlternativeId = marked.get(entry.questionId)
    const correct =
      selectedAlternativeId !== undefined &&
      selectedAlternativeId === question.correctAlternativeId

    return [
      {
        questionId: entry.questionId,
        correct,
        score: correct ? entry.score : 0,
        ...(selectedAlternativeId === undefined ? {} : { selectedAlternativeId }),
      },
    ]
  })

  return { results, score: roundScore(results.reduce((sum, item) => sum + item.score, 0)) }
}

/**
 * Adds the machine's part to the teacher's.
 *
 * Rounded to two decimals for the same reason the exam total is: the parts are
 * typed by hand, and a total ending in a floating point tail is one a teacher
 * is right to distrust.
 */
export function totalCorrectionScore(
  objectiveResults: readonly ObjectiveResult[],
  discursiveScores: readonly DiscursiveScore[],
): number {
  const objective = objectiveResults.reduce((sum, item) => sum + item.score, 0)
  const discursive = discursiveScores.reduce((sum, item) => sum + item.score, 0)
  return roundScore(objective + discursive)
}

/** The open-ended questions of an exam, in the order the exam puts them. */
export function discursiveQuestionIdsOf(exam: Exam, bank: readonly Question[]): string[] {
  const byId = new Map(bank.map((question) => [question.id, question]))

  return exam.questions
    .toSorted((a, b) => a.order - b.order)
    .filter((entry) => byId.get(entry.questionId)?.type === 'discursiva')
    .map((entry) => entry.questionId)
}

/**
 * Gives every open-ended question a mark, starting the ones with none at zero.
 *
 * The review screen always showed a zero in the empty field, so a teacher who
 * agreed with it and confirmed expected a finished correction. They did not get
 * one: nothing had been typed, so no mark existed, the status stayed open and
 * the sheet went back to the list still waiting — while the screen had said
 * zero all along. The zero is a real mark from the moment the screen opens,
 * deliberate and editable like any other.
 *
 * A mark for a question the exam no longer carries is dropped, which is what
 * keeps the total equal to the sum of what is on screen.
 */
export function withDefaultDiscursiveScores(
  discursiveQuestionIds: readonly string[],
  scores: readonly DiscursiveScore[],
): DiscursiveScore[] {
  const given = new Map(scores.map((entry) => [entry.questionId, entry]))

  return discursiveQuestionIds.map((questionId) => given.get(questionId) ?? { questionId, score: 0 })
}

/**
 * Caps a mark at what the question is worth in this exam.
 *
 * A teacher typing 12 into a question worth 10 is a slip, and letting it
 * through produces a total the exam cannot justify.
 */
export function clampDiscursiveScore(score: number, maximum: number): number {
  if (!Number.isFinite(score) || score < 0) return 0
  return roundScore(Math.min(score, maximum))
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100
}
