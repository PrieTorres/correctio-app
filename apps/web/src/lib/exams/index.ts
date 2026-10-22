/**
 * The draw of the automatic exam lives in `@correctio/domain`, because the API
 * draws on the server (#45). It is re-exported here so the screens keep
 * importing from where they always did.
 */
export { distributeScore, drawQuestions, redrawQuestion } from '@correctio/domain'
export type { DrawCriteria, DrawResult, RandomSource } from '@correctio/domain'
export { totalScore } from './score'
