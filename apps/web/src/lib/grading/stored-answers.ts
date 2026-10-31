import type { MarkedAnswer } from '@correctio/domain'
import type { Correction } from '@/types/domain'

/**
 * The marks a stored correction keeps, as a review edits them and as a
 * repository grades them again when only a score changes. A blank question
 * stays without an alternative, never with an empty one.
 */
export function answersOf(correction: Pick<Correction, 'objectiveResults'>): MarkedAnswer[] {
  return correction.objectiveResults.map(({ questionId, selectedAlternativeId }) => ({
    questionId,
    ...(selectedAlternativeId !== undefined && { selectedAlternativeId }),
  }))
}
