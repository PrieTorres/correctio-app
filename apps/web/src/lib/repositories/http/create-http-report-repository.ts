import { applicationReportSchema, consolidatedReportRowSchema, dashboardSummarySchema, REPORT_FILTER_PARAMS, type ReportFilters } from '@correctio/domain'
import { z } from 'zod'
import type { ReportRepository } from '../report-repository'
import { toQueryString, type ApiClient, type FileClient, type QueryParams } from './api-client'
import { parseEntity } from './create-http-repository'

const consolidatedSchema = z.array(consolidatedReportRowSchema)

const present = (value: string) => (value === '' ? undefined : value)

/** The filters by the names the screen keeps in its address, which the API reads too; an empty one is left out. */
function filterQuery({ classId, subject, term, from, to }: ReportFilters): QueryParams {
  return {
    [REPORT_FILTER_PARAMS.classId]: present(classId),
    [REPORT_FILTER_PARAMS.subject]: present(subject),
    [REPORT_FILTER_PARAMS.term]: present(term),
    [REPORT_FILTER_PARAMS.from]: present(from),
    [REPORT_FILTER_PARAMS.to]: present(to),
  }
}

/**
 * The reports of the API (#50): one request each, already calculated on the
 * server, instead of every list read here with `pageSize: 1000` and two more
 * requests per application.
 */
export function createHttpReportRepository(api: ApiClient & FileClient): ReportRepository {
  const applicationPath = (applicationId: string) => `/applications/${encodeURIComponent(applicationId)}/report`

  /** The name comes from the server; this is for an answer that does not say. */
  async function download(path: string, format: string) {
    const { blob, filename } = await api.download(path)
    return { blob, filename: filename ?? `relatorio.${format}` }
  }

  return {
    async dashboard() {
      return parseEntity(dashboardSummarySchema, await api.request('GET', '/dashboard'))
    },

    async application(applicationId) {
      return parseEntity(applicationReportSchema, await api.request('GET', applicationPath(applicationId)))
    },

    async consolidated() {
      return parseEntity(consolidatedSchema, await api.request('GET', '/reports/consolidated'))
    },

    exportApplication: (applicationId, format) => download(`${applicationPath(applicationId)}${toQueryString({ format })}`, format),

    exportConsolidated: (format, filters) => download(`/reports/consolidated${toQueryString({ format, ...filterQuery(filters) })}`, format),
  }
}
