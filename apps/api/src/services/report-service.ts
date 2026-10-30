import {
  buildApplicationReport,
  consolidatedRowOf,
  consolidatedRows,
  type ApplicationReport,
  type ConsolidatedReportRow,
  type DashboardSummary,
} from '@correctio/domain'
import { API_ERROR_CODE, ApiError } from '../lib/api-error'
import type { ReportRepository } from '../repositories/report-repository'

const APPLICATION_NOT_FOUND = 'Aplicação não encontrada.'

export interface ReportService {
  dashboard: (teacherId: string) => Promise<DashboardSummary>
  applicationReport: (teacherId: string, applicationId: string) => Promise<ApplicationReport>
  consolidated: (teacherId: string) => Promise<ConsolidatedReportRow[]>
}

/**
 * The panel (P1) and the reports (P18, P19), calculated here with the
 * functions of `@correctio/domain` that the demo uses in the browser, so the
 * number on screen never depends on where it was calculated.
 */
export function createReportService({ reports }: { reports: ReportRepository }): ReportService {
  return {
    async dashboard(teacherId) {
      const [counts, recent, gradable] = await Promise.all([
        reports.counts(teacherId),
        reports.recentApplications(teacherId),
        reports.gradableApplications(teacherId),
      ])
      return { ...counts, recent, gradable }
    },

    /** Another teacher's application is a 404, never a 403: the answer never tells that it exists. */
    async applicationReport(teacherId, applicationId) {
      const source = await reports.applicationSource(teacherId, applicationId)
      if (source === undefined) throw new ApiError(API_ERROR_CODE.NOT_FOUND, APPLICATION_NOT_FOUND)
      return buildApplicationReport(source)
    },

    async consolidated(teacherId) {
      return consolidatedRows((await reports.consolidatedSources(teacherId)).map(consolidatedRowOf))
    },
  }
}
