import { Button, FilterSelect, TextField } from '@/components/ui'
import { compareByLocale } from '@/lib/utils'
import { hasReportFilters, type ConsolidatedReportRow, type ReportFilters } from '@/lib/reports'

interface Option {
  value: string
  label: string
}

/**
 * Only values that exist in the report are offered, taken from its rows: a
 * filter option that leads to an empty table is a filter that looks broken.
 */
function optionsOf(rows: readonly ConsolidatedReportRow[]) {
  const distinct = (pick: (row: ConsolidatedReportRow) => string): Option[] =>
    [...new Set(rows.map(pick).filter((value) => value !== ''))]
      .toSorted(compareByLocale)
      .map((value) => ({ value, label: value }))

  const classes = new Map(rows.map((row) => [row.classId, row.className]))

  return {
    classes: [...classes].map(([value, label]) => ({ value, label })).toSorted((a, b) => compareByLocale(a.label, b.label)),
    subjects: distinct((row) => row.subject),
    terms: distinct((row) => row.term),
  }
}

/** The class, subject, term and date range filters of the consolidated report (P19). */
export function ReportFiltersBar({
  rows,
  filters,
  onChange,
  onClear,
}: Readonly<{
  rows: readonly ConsolidatedReportRow[]
  filters: ReportFilters
  onChange: (key: keyof ReportFilters, value: string) => void
  onClear: () => void
}>) {
  const options = optionsOf(rows)

  return (
    <form
      aria-label="Filtros do relatório"
      onSubmit={(event) => event.preventDefault()}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
    >
      <FilterSelect label="Turma" value={filters.classId} options={options.classes} onChange={(value) => onChange('classId', value)} />
      <FilterSelect label="Disciplina" value={filters.subject} options={options.subjects} onChange={(value) => onChange('subject', value)} />
      <FilterSelect label="Período" value={filters.term} options={options.terms} onChange={(value) => onChange('term', value)} />
      <TextField label="De" type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => onChange('from', event.target.value)} />
      <TextField label="Até" type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => onChange('to', event.target.value)} />
      {hasReportFilters(filters) && (
        <div className="sm:col-span-2 lg:col-span-5">
          <Button type="button" variant="secondary" onClick={onClear}>
            Limpar filtros
          </Button>
        </div>
      )}
    </form>
  )
}
