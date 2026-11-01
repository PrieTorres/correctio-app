import {
  buildApplicationReport,
  consolidatedRowOf,
  consolidatedRows,
  filterReportRows,
  readReportFilters,
  REPORT_FORMAT,
  type ApplicationReport,
  type ConsolidatedReportRow,
  type DashboardSummary,
  type ReportFilters,
  type ReportFormat,
} from '@correctio/domain'
import { z } from 'zod'
import { API_ERROR_CODE, ApiError } from '../lib/api-error'
import { parseRequest } from '../lib/parse-request'
import { applicationReportTable, consolidatedReportTable, renderReport, type ReportFile } from '../lib/report-export'
import type { ReportRepository } from '../repositories/report-repository'

const APPLICATION_NOT_FOUND = 'Aplicação não encontrada.'

const INVALID_FORMAT = 'Formato de exportação inválido. Use xlsx, csv ou pdf.'
const INVALID_FILTERS = 'Filtros do relatório inválidos.'

/** Every refusal of a field names the mistake in the words of the screen, instead of Zod's English. */
const saying = (message: string) => ({ error: message })

const formatQuerySchema = z.object({ format: z.enum(REPORT_FORMAT, saying(INVALID_FORMAT)).optional() })

const DAY = /^\d{4}-\d{2}-\d{2}$/

const filterText = (max: number) => z.string(saying(INVALID_FILTERS)).max(max, INVALID_FILTERS).optional()
const filterDay = z.string(saying(INVALID_FILTERS)).regex(DAY, INVALID_FILTERS).optional()

/** The filters of P19 by the names the screen keeps in its address (`REPORT_FILTER_PARAMS`). */
const filtersQuerySchema = z.object({ class: filterText(64), subject: filterText(160), term: filterText(40), from: filterDay, to: filterDay })

/**
 * The export asked for in `?format=`, as the Spec writes it for the
 * consolidated report, or `undefined` for the JSON the screens read.
 */
export function exportFormatOf(query: unknown): ReportFormat | undefined {
  return parseRequest(formatQuerySchema, query).format
}

function filtersOf(query: unknown): ReportFilters {
  const parsed: Partial<Record<string, string>> = parseRequest(filtersQuerySchema, query)
  return readReportFilters((name) => parsed[name])
}

export interface ReportService {
  dashboard: (teacherId: string) => Promise<DashboardSummary>
  applicationReport: (teacherId: string, applicationId: string) => Promise<ApplicationReport>
  /** The rows narrowed by the filters of P19 in the query, which the screen applies on its own and the export sends. */
  consolidated: (teacherId: string, query: unknown) => Promise<ConsolidatedReportRow[]>
  exportApplicationReport: (teacherId: string, applicationId: string, format: ReportFormat) => Promise<ReportFile>
  exportConsolidated: (teacherId: string, query: unknown, format: ReportFormat) => Promise<ReportFile>
}

export interface ReportServiceDependencies {
  reports: ReportRepository
  /** Injected so a test knows the day the consolidated export is named after. */
  now?: () => Date
}

const dayOf = (timestamp: string) => timestamp.slice(0, 10)

/**
 * The panel (P1) and the reports (P18, P19), calculated here with the
 * functions of `@correctio/domain` that the demo uses in the browser, so the
 * number on screen never depends on where it was calculated. The exports
 * (RF36) are drawn from the same numbers, so a file never disagrees with the
 * screen.
 */
export function createReportService({ reports, now = () => new Date() }: ReportServiceDependencies): ReportService {
  /** Another teacher's application is a 404, never a 403: the answer never tells that it exists. */
  async function applicationReport(teacherId: string, applicationId: string): Promise<ApplicationReport> {
    const source = await reports.applicationSource(teacherId, applicationId)
    if (source === undefined) throw new ApiError(API_ERROR_CODE.NOT_FOUND, APPLICATION_NOT_FOUND)
    return buildApplicationReport(source)
  }

  async function consolidated(teacherId: string, query: unknown): Promise<ConsolidatedReportRow[]> {
    const filters = filtersOf(query)
    const rows = consolidatedRows((await reports.consolidatedSources(teacherId)).map(consolidatedRowOf))
    return filterReportRows(rows, filters)
  }

  return {
    async dashboard(teacherId) {
      const [counts, recent, gradable] = await Promise.all([
        reports.counts(teacherId),
        reports.recentApplications(teacherId),
        reports.gradableApplications(teacherId),
      ])
      return { ...counts, recent, gradable }
    },

    applicationReport,
    consolidated,

    async exportApplicationReport(teacherId, applicationId, format) {
      const report = await applicationReport(teacherId, applicationId)
      return renderReport(applicationReportTable(report), format, `relatorio-aplicacao-${dayOf(report.date)}`)
    },

    async exportConsolidated(teacherId, query, format) {
      const generatedAt = now()
      const table = consolidatedReportTable(await consolidated(teacherId, query), filtersOf(query), generatedAt)
      return renderReport(table, format, `relatorio-consolidado-${dayOf(generatedAt.toISOString())}`)
    },
  }
}
