import { z } from 'zod'
import { answerSheetSchema, applicationOverviewSchema, examVersionSchema, type ApplicationInput } from '@/lib/schemas'
import type { ApplicationOverview } from '@/types/domain'
import type { ApplicationListParams, ApplicationRepository } from '../application-repository'
import type { ApiClient, FileClient } from './api-client'
import { createHttpOwnedRepository, parseEntity } from './create-http-repository'

const generatedPaperSchema = z.object({
  versions: z.array(examVersionSchema),
  sheets: z.array(answerSheetSchema),
})

/** The API names the file after the day of the application; this is for a response that does not say. */
const FALLBACK_PDF_NAME = 'prova.pdf'

/**
 * The applications of the API (P11 to P14). Every answer carries the overview
 * the screens show, and the generation, the release of grades and the PDF
 * have routes of their own under the application. The generation sends only
 * the options of P13: the versions, the sheets and their codes are made on the
 * server, and no route takes a code from the browser.
 */
export function createHttpApplicationRepository(api: ApiClient & FileClient): ApplicationRepository {
  const itemPath = (id: string) => `/applications/${encodeURIComponent(id)}`
  const owned = createHttpOwnedRepository<ApplicationOverview, ApplicationInput, ApplicationListParams>({
    api,
    resource: '/applications',
    schema: applicationOverviewSchema,
    extraQuery: ({ classId, examId, status, correction }) => ({ classId, examId, status, correction }),
  })

  return {
    ...owned,

    async generate(id, request) {
      return parseEntity(generatedPaperSchema, await api.request('POST', `${itemPath(id)}/generate-pdf`, { body: request }))
    },

    async setGradesReleased(id, released) {
      return parseEntity(
        applicationOverviewSchema,
        await api.request('POST', `${itemPath(id)}/grades-release`, { body: { released } }),
      )
    },

    async downloadPdf(id) {
      const { blob, filename } = await api.download(`${itemPath(id)}/pdf`)
      return { blob, filename: filename ?? FALLBACK_PDF_NAME }
    },
  }
}
