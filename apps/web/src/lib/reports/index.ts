/**
 * The statistics and the filters of the reports live in `@correctio/domain`,
 * because the API calculates every report on the server (#50) and filters the
 * consolidated export the way the screen does (#82), while the demo calculates
 * the same ones in this browser. They are re-exported here so the screens keep
 * importing from where they always did.
 */
export { summarise, distribute, accuracyOf, accuracyByTag } from '@correctio/domain'
export type { ScoreSummary, Distribution, QuestionAccuracy, TagAccuracy } from '@correctio/domain'
export type {
  ApplicationReport,
  ConsolidatedReportRow,
  DashboardActivity,
  DashboardSummary,
  ReportQuestion,
  ReportStudentRow,
} from '@correctio/domain'
export { filterReportRows, hasReportFilters, NO_REPORT_FILTERS, REPORT_FILTER_PARAMS, REPORT_FORMAT } from '@correctio/domain'
export type { ReportFilters, ReportFormat } from '@correctio/domain'
export { readReportFilters } from './filters'
