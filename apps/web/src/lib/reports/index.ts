/**
 * The statistics of the reports live in `@correctio/domain`, because the API
 * calculates every report on the server (#50) and the demo calculates the same
 * ones in this browser. They are re-exported here so the screens keep
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
export {
  filterReportRows,
  hasReportFilters,
  NO_REPORT_FILTERS,
  readReportFilters,
  REPORT_FILTER_PARAMS,
} from './filters'
export type { ReportFilters } from './filters'
