import PDFDocument from 'pdfkit'
import { collect, registerFonts } from '../exam-pdf/render-exam-pdf'
import { FONT } from '../exam-pdf/sheet-pages'
import { COLUMN_KIND, formatNumber, type Cell, type ReportColumn, type ReportTable } from './report-table'

/** Landscape, so an exam of 20 questions still fits its columns across one page. */
const PAGE = Object.freeze({ size: 'A4', layout: 'landscape', margin: 36 } as const)

const STYLE = Object.freeze({
  title: { font: FONT.BOLD, size: 14 },
  detail: { font: FONT.REGULAR, size: 9 },
  header: { font: FONT.BOLD, size: 8 },
  cell: { font: FONT.REGULAR, size: 8 },
  footer: { font: FONT.REGULAR, size: 7 },
} as const)

/** The height of one row of the table, enough for one line of the cell font with room around it. */
const ROW_HEIGHT = 16

/** The space between the text of a cell and the line of its column. */
const CELL_PADDING = 3

const MUTED = '#555555'
const RULE = '#9a9a9a'

interface Layout {
  left: number
  width: number
  /** Where a row must start for its whole height to stay above the footer. */
  lastRowTop: number
  /** The left edge and the width of each column, from its weight. */
  columns: { x: number; width: number; column: ReportColumn }[]
}

function layoutOf(doc: PDFKit.PDFDocument, columns: readonly ReportColumn[]): Layout {
  const left = doc.page.margins.left
  const width = doc.page.width - left - doc.page.margins.right
  const totalWeight = columns.reduce((sum, column) => sum + column.weight, 0)
  let x = left
  const placed = columns.map((column) => {
    const columnWidth = (width * column.weight) / totalWeight
    const entry = { x, width: columnWidth, column }
    x += columnWidth
    return entry
  })
  return { left, width, lastRowTop: doc.page.height - doc.page.margins.bottom - ROW_HEIGHT, columns: placed }
}

function cellText(cell: Cell): string {
  if (cell === null) return ''
  return typeof cell === 'number' ? formatNumber(cell) : cell
}

/**
 * One row, every cell on one line: a name too long for its column ends in an
 * ellipsis instead of pushing the row onto two.
 */
function drawRow(doc: PDFKit.PDFDocument, layout: Layout, cells: readonly Cell[], style: { font: string; size: number }): void {
  const top = doc.y
  doc.font(style.font).fontSize(style.size).fillColor('#000000')
  layout.columns.forEach(({ x, width, column }, index) => {
    doc.text(cellText(cells[index] ?? null), x + CELL_PADDING, top + CELL_PADDING, {
      width: width - 2 * CELL_PADDING,
      height: ROW_HEIGHT - CELL_PADDING,
      ellipsis: true,
      lineBreak: false,
      align: column.kind === COLUMN_KIND.NUMBER ? 'right' : 'left',
    })
  })
  doc
    .moveTo(layout.left, top + ROW_HEIGHT)
    .lineTo(layout.left + layout.width, top + ROW_HEIGHT)
    .lineWidth(0.5)
    .strokeColor(RULE)
    .stroke()
  doc.y = top + ROW_HEIGHT
}

function drawHeader(doc: PDFKit.PDFDocument, layout: Layout): void {
  drawRow(
    doc,
    layout,
    layout.columns.map(({ column }) => column.header),
    STYLE.header,
  )
}

function drawTitle(doc: PDFKit.PDFDocument, { title, details }: ReportTable, width: number): void {
  doc.font(STYLE.title.font).fontSize(STYLE.title.size).fillColor('#000000').text(title, { width })
  doc.font(STYLE.detail.font).fontSize(STYLE.detail.size).fillColor(MUTED)
  for (const detail of details) doc.text(detail, { width })
  doc.moveDown()
}

/**
 * The page numbers go in once every page exists. The bottom margin is lifted
 * while writing them, or pdfkit would take text below it for an overflow and
 * open a new page.
 */
function drawFooters(doc: PDFKit.PDFDocument, title: string): void {
  const { start, count } = doc.bufferedPageRange()
  for (let index = start; index < start + count; index += 1) {
    doc.switchToPage(index)
    const bottom = doc.page.margins.bottom
    doc.page.margins.bottom = 0
    doc
      .font(STYLE.footer.font)
      .fontSize(STYLE.footer.size)
      .fillColor(MUTED)
      .text(`${title} · Página ${index + 1} de ${count}`, doc.page.margins.left, doc.page.height - bottom / 2, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: 'center',
        lineBreak: false,
      })
    doc.page.margins.bottom = bottom
  }
}

/**
 * The table as a PDF to print or send (RF36), with the DejaVu fonts the exam
 * PDF embeds, so accents and symbols print. The header row is repeated on
 * every page, so a sheet in the middle of the stack still says what each
 * column is.
 */
export async function renderPdf(table: ReportTable): Promise<Buffer> {
  const doc = new PDFDocument({ size: PAGE.size, layout: PAGE.layout, margin: PAGE.margin, bufferPages: true, info: { Title: table.title, Author: 'Correctio' } })
  registerFonts(doc)
  const output = collect(doc)
  const layout = layoutOf(doc, table.columns)

  drawTitle(doc, table, layout.width)
  drawHeader(doc, layout)
  for (const row of table.rows) {
    if (doc.y > layout.lastRowTop) {
      doc.addPage()
      drawHeader(doc, layout)
    }
    drawRow(doc, layout, row, STYLE.cell)
  }
  drawFooters(doc, table.title)

  doc.end()
  return output
}
