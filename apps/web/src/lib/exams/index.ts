/**
 * The draw of the automatic exam and the total an exam is worth live in
 * `@correctio/domain`, because the API draws on the server (#45) and its
 * reports scale the grades by the same total (#50). They are re-exported here
 * so the screens keep importing from where they always did.
 */
export { distributeScore, drawQuestions, redrawQuestion, totalScore } from '@correctio/domain'
export type { DrawCriteria, DrawResult, RandomSource } from '@correctio/domain'
