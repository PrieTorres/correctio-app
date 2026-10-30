import { applicationReportSchema, consolidatedReportRowSchema, dashboardSummarySchema } from '@correctio/domain'
import { z } from 'zod'
import type { ReportRepository } from '../report-repository'
import type { ApiClient } from './api-client'
import { parseEntity } from './create-http-repository'

const consolidatedSchema = z.array(consolidatedReportRowSchema)

/**
 * The reports of the API (#50): one request each, already calculated on the
 * server, instead of every list read here with `pageSize: 1000` and two more
 * requests per application.
 */
export function createHttpReportRepository(api: ApiClient): ReportRepository {
  return {
    async dashboard() {
      return parseEntity(dashboardSummarySchema, await api.request('GET', '/dashboard'))
    },

    async application(applicationId) {
      return parseEntity(applicationReportSchema, await api.request('GET', `/applications/${encodeURIComponent(applicationId)}/report`))
    },

    async consolidated() {
      return parseEntity(consolidatedSchema, await api.request('GET', '/reports/consolidated'))
    },
  }
}
