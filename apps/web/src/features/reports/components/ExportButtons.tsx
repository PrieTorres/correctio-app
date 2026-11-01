import { Download } from 'lucide-react'
import { Button } from '@/components/ui'
import { REPORT_FORMAT } from '@/lib/reports'
import { FORMAT_LABEL, useExportReport, type ReportToExport } from '../hooks/useExportReport'

const FORMATS = [REPORT_FORMAT.XLSX, REPORT_FORMAT.CSV, REPORT_FORMAT.PDF] as const

/**
 * "Exportar Excel", "Exportar CSV" and "Exportar PDF" (P18, P19). A click
 * starts the export and the notice at the top of the screen confirms it at
 * once (RF41); the buttons wait while an export runs, one at a time (RNF13).
 */
export function ExportButtons({ report, disabled }: Readonly<{ report: ReportToExport; disabled: boolean }>) {
  const { start, running } = useExportReport()

  return (
    <div role="group" aria-label="Exportar relatório" className="flex flex-wrap gap-2">
      {FORMATS.map((format) => (
        <Button key={format} icon={<Download size={18} aria-hidden />} disabled={disabled || running} onClick={() => start(report, format)}>
          Exportar {FORMAT_LABEL[format]}
        </Button>
      ))}
    </div>
  )
}
