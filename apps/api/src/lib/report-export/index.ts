import { REPORT_FORMAT, type ReportFormat } from '@correctio/domain'
import { renderCsv } from './csv'
import { renderPdf } from './pdf'
import type { ReportTable } from './report-table'
import { renderXlsx } from './xlsx'

export { applicationReportTable, consolidatedReportTable } from './report-table'
export type { ReportTable } from './report-table'

/** An exported report, ready to go out as a download. */
export interface ReportFile {
  filename: string
  contentType: string
  content: Buffer
}

interface Renderer {
  contentType: string
  render: (table: ReportTable) => Buffer | Promise<Buffer>
}

/** `charset=utf-8` on the CSV too, for whatever opens it other than Excel, which reads the byte order mark. */
const RENDERERS: Readonly<Record<ReportFormat, Renderer>> = {
  [REPORT_FORMAT.XLSX]: { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', render: renderXlsx },
  [REPORT_FORMAT.CSV]: { contentType: 'text/csv; charset=utf-8', render: renderCsv },
  [REPORT_FORMAT.PDF]: { contentType: 'application/pdf', render: renderPdf },
}

/**
 * The file of a report in the format asked (RF36). `basename` names the
 * report and its day, never a student: the file name shows in the downloads
 * of whatever computer it was saved on.
 */
export async function renderReport(table: ReportTable, format: ReportFormat, basename: string): Promise<ReportFile> {
  const { contentType, render } = RENDERERS[format]
  return { filename: `${basename}.${format}`, contentType, content: await render(table) }
}
