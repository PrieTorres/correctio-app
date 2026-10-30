import type { ApplicationReport, ConsolidatedReportRow, ReportFilters, ScoreSummary } from '@correctio/domain'

/** A cell of an exported report: text, a number, or empty. */
export type Cell = string | number | null

/** How a column is read: text to the left, numbers to the right and with the decimal comma of pt-BR. */
export const COLUMN_KIND = Object.freeze({ TEXT: 'TEXT', NUMBER: 'NUMBER' } as const)

export type ColumnKind = (typeof COLUMN_KIND)[keyof typeof COLUMN_KIND]

export interface ReportColumn {
  header: string
  kind: ColumnKind
  /** The share of the page width the PDF gives it, relative to the other columns. */
  weight: number
}

/**
 * One report as every format writes it. The spreadsheet and the CSV carry the
 * table only, so they can be sorted and summed; the PDF, made to be read,
 * prints the title and the details above it.
 */
export interface ReportTable {
  title: string
  details: string[]
  columns: ReportColumn[]
  rows: Cell[][]
}

const textColumn = (header: string, weight = 3): ReportColumn => ({ header, kind: COLUMN_KIND.TEXT, weight })
/** Wide enough for the header in the PDF, so "Versão" and "Total" are never cut beside twenty question columns. */
const numberColumn = (header: string): ReportColumn => ({ header, kind: COLUMN_KIND.NUMBER, weight: Math.max(1, (header.length + 1) / 4) })

/** A day as the screens show it, `dd/mm/aaaa`, from the UTC day the server keeps sittings by. */
export function formatDay(timestamp: string): string {
  const [year, month, day] = timestamp.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

/** A number the way a Brazilian reader writes it: decimal comma, at most two decimals, no thousands dot. */
export function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2, useGrouping: false })
}

function summaryLine({ mean, median, standardDeviation, lowest, highest }: ScoreSummary): string {
  return [`Média ${formatNumber(mean)}`, `Mediana ${formatNumber(median)}`, `Desvio padrão ${formatNumber(standardDeviation)}`, `Menor ${formatNumber(lowest)}`, `Maior ${formatNumber(highest)}`].join(' · ')
}

function progressLine({ summary, sheets, inProgress }: ApplicationReport): string {
  const corrected = `Corrigidas: ${summary.count} de ${sheets} folhas`
  return inProgress === 0 ? corrected : `${corrected} · ${inProgress} em andamento, fora das contas`
}

/**
 * The report of one application (P18) as a table: one row per finished
 * correction, with name, registration, version, the score of each question
 * and the total. The columns are the ones the issue and the screen describe
 * while the client has not validated them (#69): "Q1" is question 1 of the
 * exam, whatever order the student's version printed it in, and a sheet
 * still without a student comes as "Folha N" with no registration.
 */
export function applicationReportTable(report: ApplicationReport): ReportTable {
  return {
    title: report.examTitle,
    details: [`Turma: ${report.className}`, `Data: ${formatDay(report.date)}`, progressLine(report), summaryLine(report.summary)],
    columns: [textColumn('Aluno', 6), textColumn('Matrícula'), numberColumn('Versão'), ...report.questions.map((question) => numberColumn(`Q${question.number}`)), numberColumn('Total')],
    rows: report.students.map((student) => [student.name, student.registration, student.versionNumber, ...student.questionScores, student.totalScore]),
  }
}

/** The filters that narrowed the rows, said in the PDF so a printed report tells what it covers. */
function filterLine(filters: ReportFilters, rows: readonly ConsolidatedReportRow[]): string | null {
  const className = rows.find((row) => row.classId === filters.classId)?.className ?? filters.classId
  const parts = [
    filters.classId === '' ? null : `turma ${className}`,
    filters.subject === '' ? null : `disciplina ${filters.subject}`,
    filters.term === '' ? null : `período ${filters.term}`,
    filters.from === '' ? null : `de ${formatDay(filters.from)}`,
    filters.to === '' ? null : `até ${formatDay(filters.to)}`,
  ].filter((part) => part !== null)
  return parts.length === 0 ? null : `Filtros: ${parts.join(', ')}`
}

/** The consolidated report (P19) as a table: one row per application, with the columns of the screen. */
export function consolidatedReportTable(rows: readonly ConsolidatedReportRow[], filters: ReportFilters, generatedAt: Date): ReportTable {
  const filtered = filterLine(filters, rows)
  return {
    title: 'Relatório consolidado',
    details: [`Gerado em ${formatDay(generatedAt.toISOString())}`, ...(filtered === null ? [] : [filtered])],
    columns: [textColumn('Prova', 5), textColumn('Turma', 4), textColumn('Data', 2), numberColumn('Corrigidas'), numberColumn('Média'), numberColumn('Menor'), numberColumn('Maior')],
    rows: rows.map(({ examTitle, className, date, summary }) => [examTitle, className, formatDay(date), summary.count, summary.mean, summary.lowest, summary.highest]),
  }
}
