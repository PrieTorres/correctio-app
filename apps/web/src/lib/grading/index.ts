/**
 * The grading rules live in `@correctio/domain`, because the API recalculates
 * every grade the screens show (#47). They are re-exported here so the screens
 * keep importing from where they always did.
 */
export {
  clampDiscursiveScore,
  discursiveQuestionIdsOf,
  gradeObjectives,
  resolveCorrectionStatus,
  totalCorrectionScore,
  withDefaultDiscursiveScores,
} from '@correctio/domain'
export type { GradedObjectives, MarkedAnswer } from '@correctio/domain'
export { readPhotoInBrowser } from './read-photo-in-browser'
export type { PhotoReading, ReadingContext } from './read-photo-in-browser'
