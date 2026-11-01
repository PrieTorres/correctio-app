import { correctionSchema } from '@/lib/schemas'
import type { CorrectionRepository } from '../correction-repository'
import { LARGEST_PAGE, readEveryPage } from '../read-every-page'
import type { ApiClient } from './api-client'
import { parseEntity, parsePage } from './create-http-repository'

/**
 * The corrections on the API, under their application (#47): the review goes
 * in, and the correction the server graded comes back. Every page is read,
 * since the screens need every sheet's correction to say which are done.
 */
export function createHttpCorrectionRepository(api: ApiClient): CorrectionRepository {
  const correctionsPath = (applicationId: string) => `/applications/${encodeURIComponent(applicationId)}/corrections`

  return {
    listByApplication: (applicationId, { assigned } = {}) =>
      readEveryPage(async (page) =>
        parsePage(correctionSchema, await api.request('GET', correctionsPath(applicationId), { query: { page, pageSize: LARGEST_PAGE, assigned } })),
      ),

    async create(applicationId, review) {
      return parseEntity(correctionSchema, await api.request('POST', correctionsPath(applicationId), { body: review }))
    },

    async update(applicationId, correctionId, changes) {
      const path = `${correctionsPath(applicationId)}/${encodeURIComponent(correctionId)}`
      return parseEntity(correctionSchema, await api.request('PATCH', path, { body: changes }))
    },
  }
}
