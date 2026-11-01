import { resolvePublicLookup, type PublicLookup } from '@correctio/domain'
import type { PublicLookupRepository } from '../repositories/public-lookup-repository'

/** The width of `answer_sheets.code`: anything longer was never printed. */
const MAX_CODE_LENGTH = 32

const INVALID_CODE: PublicLookup = { status: 'INVALID_CODE' }

export interface PublicLookupService {
  lookup: (code: string) => Promise<PublicLookup>
}

/**
 * The public lookup of PUB1 on the server. An unknown code is an answer, not
 * an error: it comes back as `INVALID_CODE`, the same as a code that exists but
 * leads nowhere, so a stranger cannot tell the two apart. What is shown beyond
 * that is decided by `resolvePublicLookup`, the same rule the web app applies.
 */
export function createPublicLookupService(repository: PublicLookupRepository): PublicLookupService {
  return {
    async lookup(code) {
      if (code.length === 0 || code.length > MAX_CODE_LENGTH) return INVALID_CODE
      return resolvePublicLookup(await repository.findSources(code))
    },
  }
}
