/**
 * What narrows the consolidated report (P19), shared so the export of the API
 * keeps the rows the screen shows (#82). An empty string means "no restriction",
 * which is also what an absent URL parameter reads as, so the unfiltered report
 * needs no special case.
 */
export interface ReportFilters {
  classId: string
  subject: string
  term: string
  /** First day included, as a date input writes it (`yyyy-MM-dd`). */
  from: string
  /** Last day included, same form. */
  to: string
}

export const NO_REPORT_FILTERS: ReportFilters = { classId: '', subject: '', term: '', from: '', to: '' }

export interface Filterable {
  classId: string
  subject: string
  term: string
  date: string
}

/**
 * The URL parameter of each filter, so a filtered report can be reloaded or
 * shared. Typed by the filter keys, which keeps a new filter from being added
 * without a parameter.
 */
export const REPORT_FILTER_PARAMS: Record<keyof ReportFilters, string> = {
  classId: 'class',
  subject: 'subject',
  term: 'term',
  from: 'from',
  to: 'to',
}

/**
 * Reads the filters by their parameter names from wherever they came: the
 * address of the screen or the query of the export route.
 */
export function readReportFilters(valueOf: (parameter: string) => string | null | undefined): ReportFilters {
  const read = (key: keyof ReportFilters) => valueOf(REPORT_FILTER_PARAMS[key]) ?? ''
  return { classId: read('classId'), subject: read('subject'), term: read('term'), from: read('from'), to: read('to') }
}

export function hasReportFilters(filters: ReportFilters): boolean {
  return Object.values(filters).some((value) => value !== '')
}

/** The `yyyy-MM-dd` of a stored timestamp, the UTC day the server compares sittings by. */
function dayOf(timestamp: string): string {
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function matchesPeriod(date: string, { from, to }: Pick<ReportFilters, 'from' | 'to'>): boolean {
  const day = dayOf(date)
  return (from === '' || day >= from) && (to === '' || day <= to)
}

/**
 * Keeps the rows that satisfy every active filter.
 *
 * Applied to the rows before any statistic is computed from them, so a mean
 * can only ever describe what is on screen.
 */
export function filterReportRows<Row extends Filterable>(rows: readonly Row[], filters: ReportFilters): Row[] {
  return rows.filter(
    (row) =>
      (filters.classId === '' || row.classId === filters.classId) &&
      (filters.subject === '' || row.subject === filters.subject) &&
      (filters.term === '' || row.term === filters.term) &&
      matchesPeriod(row.date, filters),
  )
}
