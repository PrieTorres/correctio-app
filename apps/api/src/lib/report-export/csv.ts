import { formatNumber, type Cell, type ReportTable } from './report-table'

/**
 * Excel in Portuguese reads `;` as the column separator, because the comma is
 * the decimal separator; with `,` every row would land in one column.
 */
const SEPARATOR = ';'

/** The byte order mark is what makes Excel read the file as UTF-8, so "Matrícula" keeps its accent. */
const UTF8_BOM = '\uFEFF'

/** The line break Excel writes, which every spreadsheet reads. */
const LINE_BREAK = '\r\n'

/**
 * A cell starting with one of these is taken for a formula by Excel. Names
 * arrive by import, so a student called `=HYPERLINK(...)` would become a link
 * on the teacher's machine (CSV injection, OWASP).
 */
const FORMULA_START = /^[=+\-@\t\r]/

const NEEDS_QUOTES = /[";\r\n]/

/** Text that would start a formula gets a leading apostrophe, which Excel shows as plain text. */
export function neutralizeFormula(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value
}

function quoted(value: string): string {
  return NEEDS_QUOTES.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

function cellText(cell: Cell): string {
  if (cell === null) return ''
  if (typeof cell === 'number') return formatNumber(cell)
  return quoted(neutralizeFormula(cell))
}

function line(cells: readonly Cell[]): string {
  return cells.map(cellText).join(SEPARATOR)
}

/** The table as a CSV that Excel in Portuguese opens with the accents and the columns right (RF36). */
export function renderCsv(table: ReportTable): Buffer {
  const lines = [line(table.columns.map((column) => column.header)), ...table.rows.map(line)]
  return Buffer.from(UTF8_BOM + lines.join(LINE_BREAK) + LINE_BREAK, 'utf8')
}
