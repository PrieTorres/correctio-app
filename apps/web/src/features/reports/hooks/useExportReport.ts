import { useServices } from '@/app/services';
import { useBackgroundJob, useIsJobRunning, type JobRequest } from '@/lib/background-jobs';
import { REPORT_FORMAT, type ReportFilters, type ReportFormat } from '@/lib/reports';
import { BACKGROUND_JOB_TYPE } from '@/types/domain';

/** The two reports that export: one application's (P18) and the consolidated one (P19). */
export const REPORT_KIND = Object.freeze({ APPLICATION: 'APPLICATION', CONSOLIDATED: 'CONSOLIDATED' } as const);

/** Which report to export, and what it needs: the application, or the filters on screen. */
export type ReportToExport =
  | { kind: typeof REPORT_KIND.APPLICATION; applicationId: string }
  | { kind: typeof REPORT_KIND.CONSOLIDATED; filters: ReportFilters };

export interface ExportRequest extends JobRequest {
  report: ReportToExport;
  format: ReportFormat;
}

/** How each format is named on the buttons and in the notice. */
export const FORMAT_LABEL: Readonly<Record<ReportFormat, string>> = {
  [REPORT_FORMAT.XLSX]: 'Excel',
  [REPORT_FORMAT.CSV]: 'CSV',
  [REPORT_FORMAT.PDF]: 'PDF',
};

/** The line of the notice, which names the report and the format but never a student. */
export function exportLabel(report: ReportToExport, format: ReportFormat): string {
  const name = report.kind === REPORT_KIND.APPLICATION ? 'Relatório da aplicação' : 'Relatório consolidado';
  return `${name} em ${FORMAT_LABEL[format]}`;
}

/**
 * RF36 and RF41: the file is made on the server while the teacher goes on
 * working. The export is a background job, so the notice of the layout says
 * it started at once and offers the file when it arrives, on whatever screen
 * she is by then. One at a time (RNF13): the buttons wait while one runs.
 */
export function useExportReport() {
  const { repositories } = useServices();
  const job = useBackgroundJob(
    BACKGROUND_JOB_TYPE.EXPORT,
    ({ report, format }: ExportRequest) =>
      report.kind === REPORT_KIND.APPLICATION
        ? repositories.reports.exportApplication(report.applicationId, format)
        : repositories.reports.exportConsolidated(format, report.filters),
    { readsOnly: true },
  );
  const running = useIsJobRunning(BACKGROUND_JOB_TYPE.EXPORT);

  return {
    start: (report: ReportToExport, format: ReportFormat) => job.mutate({ report, format, label: exportLabel(report, format) }),
    running,
  };
}
