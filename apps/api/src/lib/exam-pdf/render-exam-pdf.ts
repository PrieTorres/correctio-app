import { createRequire } from 'node:module'
import type { ExamVersion } from '@correctio/domain'
import PDFDocument from 'pdfkit'
import { drawBlankPage, drawFooter, measurerFor } from './draw'
import { drawCover } from './draw-cover'
import { drawQuestionsPage } from './draw-questions'
import type { PrintedSheet, PrintJob } from './print-job'
import { coverContent, sheetQuestions, type CoverContent } from './sheet-content'
import { FONT, measureQuestion, planSheetPages, type FontName, type SheetPage } from './sheet-pages'

/**
 * DejaVu, embedded in the PDF: the standard PDF fonts have no glyph for the
 * symbols a statement may use, such as `→`, `≤` or `x³`, and would print a gap
 * where the student needs the symbol. pdfkit embeds only the glyphs used.
 */
const FONT_FILES: Readonly<Record<FontName, string>> = {
  [FONT.REGULAR]: 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf',
  [FONT.BOLD]: 'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf',
  [FONT.MONO]: 'dejavu-fonts-ttf/ttf/DejaVuSansMono.ttf',
}

const resolvePackageFile = createRequire(import.meta.url).resolve

/** Margins are zero because every position is placed by hand from the plan. */
export const PAGE_OPTIONS = { size: 'A4', margin: 0 } as const

/** Registers the embedded fonts under the names of `FONT`, for every PDF the API draws: the exam and the reports (#82). */
export function registerFonts(doc: PDFKit.PDFDocument): void {
  for (const [name, file] of Object.entries(FONT_FILES)) doc.registerFont(name, resolvePackageFile(file))
}

/**
 * A document with the fonts registered and no page yet. The tests that hold a
 * layout to the page measure with it too, since only the embedded fonts give
 * the heights the paper will have.
 */
export function createDocument(title: string): PDFKit.PDFDocument {
  const doc = new PDFDocument({ ...PAGE_OPTIONS, autoFirstPage: false, info: { Title: title, Author: 'Correctio' } })
  registerFonts(doc)
  return doc
}

/** The bytes of a document once `end()` is called; listen before drawing, or the first chunks are lost. */
export function collect(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
}

function drawPage(doc: PDFKit.PDFDocument, page: SheetPage, cover: CoverContent): void {
  if (page.kind === 'COVER') drawCover(doc, cover)
  else if (page.kind === 'QUESTIONS') drawQuestionsPage(doc, page.questions)
  else drawBlankPage(doc)
}

interface SheetToPrint {
  job: PrintJob
  printed: PrintedSheet
  version: ExamVersion
}

/**
 * One sheet: its cover, its questions and, when RF44 asks for it, a blank
 * page. The cover page is opened first so pdfkit can measure the questions;
 * every other page comes from the plan.
 */
function drawSheet(doc: PDFKit.PDFDocument, { job, printed, version }: SheetToPrint): void {
  doc.addPage(PAGE_OPTIONS)
  const cover = coverContent(job, printed, version)
  const measure = measurerFor(doc)
  const pages = planSheetPages(sheetQuestions(version, job.questions).map((content) => measureQuestion(content, measure)))

  pages.forEach((page, index) => {
    if (index > 0) doc.addPage(PAGE_OPTIONS)
    drawPage(doc, page, cover)
    if (page.kind !== 'BLANK') drawFooter(doc, `${cover.sheetLabel} · Página ${index + 1} de ${pages.length}`)
  })
}

function requireVersion(versions: ReadonlyMap<string, ExamVersion>, printed: PrintedSheet): ExamVersion {
  const version = versions.get(printed.sheet.examVersionId)
  if (version === undefined) throw new Error(`Sheet ${printed.sheet.sheetNumber} points at a version that is not in the print job`)
  return version
}

/**
 * The PDF of an application (RF23): every sheet in the order of its number,
 * each with its cover and answer card, then its questions in the order of its
 * version, never split across pages (RF43), and a blank page when the sheet
 * would end on an odd one (RF44), so a stack printed on both sides keeps every
 * sheet apart.
 */
export async function renderExamPdf(job: PrintJob): Promise<Buffer> {
  if (job.sheets.length === 0) throw new Error('Nothing to print: the application has no sheets')

  const doc = createDocument(job.examTitle)
  const output = collect(doc)
  const versions = new Map(job.versions.map((version) => [version.id, version]))
  const sheets = [...job.sheets].sort((a, b) => a.sheet.sheetNumber - b.sheet.sheetNumber)

  for (const printed of sheets) drawSheet(doc, { job, printed, version: requireVersion(versions, printed) })

  doc.end()
  return output
}
