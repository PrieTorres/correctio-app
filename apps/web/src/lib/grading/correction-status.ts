import { CORRECTION_STATUS, type CorrectionStatus, type DiscursiveScore, type Id } from '@/types/domain'

/**
 * Decides whether a correction is finished or still waiting on the teacher.
 *
 * An exam without open-ended questions is done the moment the sheet is read.
 * With them, the machine grades what it can and the correction stays open
 * until every open-ended question carries a score — including a score of zero,
 * which is a deliberate grade and not an absence.
 */
export function resolveCorrectionStatus(
  discursiveQuestionIds: readonly Id[],
  discursiveScores: readonly DiscursiveScore[],
): CorrectionStatus {
  const scored = new Set(discursiveScores.map((entry) => entry.questionId))
  const allScored = discursiveQuestionIds.every((questionId) => scored.has(questionId))
  return allScored ? CORRECTION_STATUS.DONE : CORRECTION_STATUS.IN_PROGRESS
}
