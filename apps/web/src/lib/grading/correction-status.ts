import type { CorrectionStatus, DiscursiveScore, Id } from '@/types/domain'

/**
 * Decides whether a correction is finished or still waiting on the teacher.
 *
 * An exam without open-ended questions is complete the moment the sheet is
 * read. With them, the machine grades what it can and the correction stays
 * open until every open-ended question carries a score — including a score of
 * zero, which is a deliberate grade and not an absence.
 */
export function resolveCorrectionStatus(
  discursiveQuestionIds: readonly Id[],
  discursiveScores: readonly DiscursiveScore[],
): CorrectionStatus {
  const scored = new Set(discursiveScores.map((entry) => entry.questionId))
  const allScored = discursiveQuestionIds.every((questionId) => scored.has(questionId))
  return allScored ? 'concluida' : 'em_andamento'
}

/** Open-ended questions still missing a score, in the exam's own order. */
export function pendingDiscursiveQuestionIds(
  discursiveQuestionIds: readonly Id[],
  discursiveScores: readonly DiscursiveScore[],
): Id[] {
  const scored = new Set(discursiveScores.map((entry) => entry.questionId))
  return discursiveQuestionIds.filter((questionId) => !scored.has(questionId))
}
