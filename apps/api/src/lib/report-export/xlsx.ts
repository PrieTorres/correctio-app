import writeXlsxFile, { type Cell as SheetCell, type SheetData } from 'write-excel-file/node'
import { COLUMN_KIND, type Cell, type ReportTable } from './report-table'

/** The name of the sheet; Excel refuses one longer than 31 characters, which an exam title can be. */
const SHEET_NAME = 'Relatório'

/** Roughly how many characters wide a column of each weight opens in Excel. */
const CHARACTERS_PER_WEIGHT = 6

/**
 * Every text goes as a typed string cell, never as a formula: Excel shows
 * `=HYPERLINK(...)` in a name as the text it is, so the spreadsheet needs no
 * apostrophe, unlike the CSV.
 */
function sheetCell(cell: Cell): SheetCell {
  if (cell === null) return null
  return typeof cell === 'number' ? { type: Number, value: cell } : { type: String, value: cell }
}

/** The table as an Excel workbook (RF36), with the header in bold and kept in view while scrolling. */
export async function renderXlsx(table: ReportTable): Promise<Buffer> {
  const header = table.columns.map((column): SheetCell => ({
    type: String,
    value: column.header,
    fontWeight: 'bold',
    align: column.kind === COLUMN_KIND.NUMBER ? 'right' : 'left',
  }))
  const data: SheetData = [header, ...table.rows.map((row) => row.map(sheetCell))]
  const columns = table.columns.map((column) => ({ width: Math.max(column.header.length + 2, column.weight * CHARACTERS_PER_WEIGHT) }))

  return writeXlsxFile(data, { sheet: SHEET_NAME, columns, stickyRowsCount: 1 }).toBuffer()
}
