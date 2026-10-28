import { answerSheetSchema, examVersionSchema } from '@/lib/schemas'
import { StorageError } from '@/lib/storage/errors'
import type { PrintingRepository } from '../printing-repository'
import type { ApiClient } from './api-client'
import { parsePage, type ResponseSchema } from './create-http-repository'
import { LARGEST_PAGE, readEveryPage } from './read-every-page'

/** Never shown on a screen: the public page reads its own route whenever there is an API. */
const NO_LOOKUP_BY_CODE = 'A folha pelo código é consultada pela rota pública, não pelo professor.'

/**
 * The versions and sheets of an application on the API, always under the
 * application, which is how the API checks they belong to the teacher.
 */
export function createHttpPrintingRepository(api: ApiClient): PrintingRepository {
  const applicationPath = (applicationId: string) => `/applications/${encodeURIComponent(applicationId)}`

  const readAll = <T>(schema: ResponseSchema<T>, path: string) =>
    readEveryPage(async (page) => parsePage(schema, await api.request('GET', path, { query: { page, pageSize: LARGEST_PAGE } })))

  return {
    listVersions: (applicationId) => readAll(examVersionSchema, `${applicationPath(applicationId)}/versions`),

    listSheets: (applicationId) => readAll(answerSheetSchema, `${applicationPath(applicationId)}/sheets`),

    /**
     * The API finds a sheet by its code only on the public route (#49), which
     * answers what a student may see rather than the sheet itself, so a
     * teacher's repository has nothing to ask it for.
     */
    findSheetByCode() {
      return Promise.reject(new StorageError(NO_LOOKUP_BY_CODE, 'failure'))
    },

    async publishAnswerKey(applicationId, versionId, published) {
      const versionPath = `${applicationPath(applicationId)}/versions/${encodeURIComponent(versionId)}`
      await api.request('POST', `${versionPath}/publish-answer-key`, { body: { published } })
    },

    async publishAll(applicationId) {
      await api.request('POST', `${applicationPath(applicationId)}/publish-answer-keys`)
    },
  }
}
