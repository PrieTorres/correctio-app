import type { ExamQuestion } from '@/types/domain'

/**
 * Adds up what an exam is worth.
 *
 * Rounded to two decimals because the parts are typed by hand: adding 3.33
 * three times in binary floating point gives 9.99 followed by a tail, and a
 * teacher reading "9.990000000000002" on screen would be right to distrust it.
 *
 * Nothing here validates the result. Closing an exam on ten points is the
 * teacher's call, and the screens show the total without ever blocking a save.
 */
export function totalScore(questions: readonly ExamQuestion[]): number {
  return Math.round(questions.reduce((sum, item) => sum + item.score, 0) * 100) / 100
}
