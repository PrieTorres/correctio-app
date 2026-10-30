import { readReportFilters as readFilters, type ReportFilters } from '@correctio/domain'

/** The filters of the consolidated report from the address of the screen, so a filtered report survives a reload. */
export function readReportFilters(params: URLSearchParams): ReportFilters {
  return readFilters((name) => params.get(name))
}
