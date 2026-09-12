import type { ExamVersion, Question } from '@/types/domain'
import type { RandomSource } from '@/lib/exams'
import type { MarkedAnswer } from './score'

/**
 * Produces a plausible reading of a photographed answer sheet.
 *
 * The N1 has no server to read an image with, and `localStorage` holds about
 * 5 MB — a single phone photo in base64 exceeds it. So the reading is simulated
 * from the layout that was printed: every question gets an answer, most of them
 * the right one, and a few wrong so the review screen has something to review.
 *
 * The randomness is injected so a test can assert the reading instead of
 * sampling it. Real reading arrives with the server, and the screens above this
 * do not change when it does: they already treat a reading as something to
 * check rather than to trust.
 */
export function readSheet(
  version: ExamVersion,
  bank: readonly Question[],
  random: RandomSource = Math.random,
): MarkedAnswer[] {
  const byId = new Map(bank.map((question) => [question.id, question]))

  return version.layout.questionOrder.flatMap((questionId): MarkedAnswer[] => {
    const question = byId.get(questionId)
    if (question === undefined || question.type !== 'objetiva') return []
    if (question.alternatives === undefined || question.alternatives.length === 0) return []

    const draw = random()

    /** One in ten sheets has a question left blank, which the review must show. */
    if (draw < 0.1) return [{ questionId }]

    if (draw < 0.75) return [{ questionId, selectedAlternativeId: question.correctAlternativeId }]

    const wrong = question.alternatives.filter(
      (alternative) => alternative.id !== question.correctAlternativeId,
    )
    const picked = wrong[Math.min(Math.floor(random() * wrong.length), wrong.length - 1)]

    return [{ questionId, selectedAlternativeId: picked?.id }]
  })
}

/** The demonstration photographs shipped with the build. */
export const DEMO_SHEET_IMAGES = [
  '/demo-sheets/folha-01.svg',
  '/demo-sheets/folha-02.svg',
  '/demo-sheets/folha-03.svg',
] as const
