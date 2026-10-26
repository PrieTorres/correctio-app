/**
 * `paginate`, the building of versions and sheets and the rule of regenerating
 * live in `@correctio/domain`, shared with the API that generates and prints
 * the exam (#46). This path stays so the screens keep importing from where
 * they always did.
 */
export { paginate } from '@correctio/domain/applications'
export type { PageBlock, PaginationResult } from '@correctio/domain/applications'
export { buildAnswerSheets, buildVersions, canRegenerate } from '@correctio/domain'
export type { RegenerationVerdict, VersionCriteria } from '@correctio/domain'
