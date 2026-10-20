/**
 * `paginate` lives in `@correctio/domain`, shared with the API that prints the
 * exam (#46). This path stays so the screens keep importing from where they
 * always did.
 */
export { paginate } from '@correctio/domain/applications'
export type { PageBlock, PaginationResult } from '@correctio/domain/applications'
export { buildVersions, buildAnswerSheets } from './build-versions'
export type { VersionCriteria } from './build-versions'
export { canRegenerate } from './regeneration'
export type { RegenerationVerdict } from './regeneration'
