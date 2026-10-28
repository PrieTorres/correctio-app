import { useSearchParams } from 'react-router-dom'
import {
  readReportFilters,
  REPORT_FILTER_PARAMS,
  type ReportFilters,
} from '@/lib/reports'

/**
 * The consolidated report's filters, kept in the URL so a filtered report
 * survives a reload and can be sent as a link. A filter that is cleared leaves
 * the URL instead of staying in it empty.
 */
export function useReportFilters(): {
  filters: ReportFilters
  setFilter: (key: keyof ReportFilters, value: string) => void
  clear: () => void
} {
  const [params, setParams] = useSearchParams()

  const setFilter = (key: keyof ReportFilters, value: string) => {
    const updated = new URLSearchParams(params)
    if (value === '') updated.delete(REPORT_FILTER_PARAMS[key])
    else updated.set(REPORT_FILTER_PARAMS[key], value)
    setParams(updated, { replace: true })
  }

  const clear = () => {
    const updated = new URLSearchParams(params)
    for (const name of Object.values(REPORT_FILTER_PARAMS)) updated.delete(name)
    setParams(updated, { replace: true })
  }

  return { filters: readReportFilters(params), setFilter, clear }
}
