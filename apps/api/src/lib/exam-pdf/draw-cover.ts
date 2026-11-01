import { ANSWER_CARD, bubbleCenter, columnLetter, type AnswerCardRow } from '@correctio/domain'
import QRCode from 'qrcode'
import { INK, measurerFor, MUTED, RULE, useStyle, writeText, type TextBox } from './draw'
import type { CoverContent } from './sheet-content'
import { mm, STYLE, type Measure, type TextStyle } from './sheet-pages'

const { frame, markerSize, markerCenters, qr, bubbleRadius } = ANSWER_CARD

/** The header and the instructions use the width of the card, above it. */
const HEADER_LEFT = mm(frame.x)
const HEADER_WIDTH = mm(frame.width)
const HEADER_TOP = mm(15)
export const HEADER_BOTTOM = mm(frame.y - 4)

/**
 * How many lines the title and the class line may take. They are the only
 * parts of the header a teacher writes at any length, so they are cut there,
 * with an ellipsis, and the instructions below them always fit above the card.
 */
const TITLE_LINES = 2
const CLASS_LINE_LINES = 1

/**
 * Room added below each block, in points, so that the rounding of the sums
 * pdfkit makes while wrapping never drops a last line that was measured to
 * fit. It is far smaller than a line, so it never lets one more line in.
 */
const LINE_ROUNDING = 0.5

/** What a student without a printed name fills in, long enough for a full name. */
const BLANK_IDENTITY = 'Nome: _______________________________________________   Matrícula: ________________'

/** A text of the header, the space above it and, for the texts a teacher writes, how many lines it may take. */
interface HeaderText {
  text: string
  style: TextStyle
  spaceAbove: number
  maxLines?: number
}

/** A text of the header with the box it is drawn in. */
export interface HeaderBlock {
  text: string
  style: TextStyle
  box: TextBox
}

/** The texts of the header from top to bottom, with the spacing the cover has always had. */
function headerTexts(cover: CoverContent): HeaderText[] {
  const identity =
    cover.identity.kind === 'STUDENT'
      ? { text: cover.identity.text, style: STYLE.bodyBold }
      : { text: BLANK_IDENTITY, style: STYLE.body }

  return [
    { text: cover.title, style: STYLE.title, spaceAbove: 0, maxLines: TITLE_LINES },
    { text: cover.classLine, style: STYLE.body, spaceAbove: 4, maxLines: CLASS_LINE_LINES },
    { text: cover.sittingLine, style: STYLE.body, spaceAbove: 2 },
    { ...identity, spaceAbove: 10 },
    { text: 'Como preencher o cartão-resposta', style: STYLE.bodyBold, spaceAbove: 14 },
    ...cover.instructions.map((line, index) => ({ text: `•  ${line}`, style: STYLE.small, spaceAbove: index === 0 ? 3 : 2 })),
  ]
}

/** The height of `lines` lines of `style`, which is where a text allowed no more is cut. */
function heightOfLines(measure: Measure, style: TextStyle, lines: number): number {
  return measure(Array.from({ length: lines }, () => 'X').join('\n'), style, HEADER_WIDTH)
}

/**
 * Where each text of the header goes, measured before anything is drawn.
 * Before, every text could run until the card, so a long title pushed the
 * instructions past it and they silently disappeared. `bottom` is where the
 * last instruction ends; a test holds it above the card for the longest texts
 * the schemas accept. The boxes still stop at the card, so even a text that
 * outgrew that test would be cut rather than printed over the bubbles.
 */
export function planHeader(cover: CoverContent, measure: Measure): { blocks: HeaderBlock[]; bottom: number } {
  let y = HEADER_TOP
  const blocks = headerTexts(cover).map(({ text, style, spaceAbove, maxLines }): HeaderBlock => {
    const top = y + spaceAbove
    const natural = measure(text, style, HEADER_WIDTH)
    const height = maxLines === undefined ? natural : Math.min(natural, heightOfLines(measure, style, maxLines))
    y = top + height
    return { text, style, box: { x: HEADER_LEFT, y: top, width: HEADER_WIDTH, bottom: Math.min(y + LINE_ROUNDING, HEADER_BOTTOM) } }
  })
  return { blocks, bottom: y }
}

function drawHeader(doc: PDFKit.PDFDocument, cover: CoverContent): void {
  for (const { text, style, box } of planHeader(cover, measurerFor(doc)).blocks) writeText(doc, text, style, box)
}

/** The four black squares the reading of the photo straightens the card by (#78). */
function drawMarkers(doc: PDFKit.PDFDocument): void {
  for (const center of Object.values(markerCenters)) {
    doc.rect(mm(center.x - markerSize / 2), mm(center.y - markerSize / 2), mm(markerSize), mm(markerSize))
  }
  doc.fill(INK)
}

function drawFrame(doc: PDFKit.PDFDocument): void {
  doc.lineWidth(0.8).rect(mm(frame.x), mm(frame.y), mm(frame.width), mm(frame.height)).stroke(RULE)
  useStyle(doc, STYLE.cardLabel, MUTED).text('CARTÃO-RESPOSTA', mm(frame.x + 5), mm(frame.y + 4), { lineBreak: false })
}

/** A label centred on a point of the card, on one line. */
function centeredLabel(doc: PDFKit.PDFDocument, text: string, center: { x: number; y: number }): void {
  const width = mm(10)
  doc.text(text, mm(center.x) - width / 2, mm(center.y), { width, align: 'center', baseline: 'middle', lineBreak: false })
}

function drawColumnLetters(doc: PDFKit.PDFDocument): void {
  useStyle(doc, STYLE.cardLabel)
  ANSWER_CARD.columns.forEach((_letter, column) => {
    centeredLabel(doc, columnLetter(column), { x: bubbleCenter(0, column).x, y: ANSWER_CARD.columnLettersY })
  })
}

/**
 * One row per printed question. An open-ended row keeps its number, so the
 * rows count the questions as the student reads them, and says it has no
 * bubbles instead of leaving the student looking for them.
 */
function drawRow(doc: PDFKit.PDFDocument, { row, bubbles }: AnswerCardRow): void {
  const { y } = bubbleCenter(row, 0)
  const labelWidth = mm(12)
  useStyle(doc, STYLE.cardLabel).text(String(row + 1), mm(ANSWER_CARD.rowLabelRight) - labelWidth, mm(y), {
    width: labelWidth,
    align: 'right',
    baseline: 'middle',
    lineBreak: false,
  })

  if (bubbles === 0) {
    const x = mm(ANSWER_CARD.firstBubble.x - bubbleRadius)
    useStyle(doc, STYLE.small, MUTED).text('discursiva', x, mm(y), { baseline: 'middle', lineBreak: false })
    return
  }

  for (let column = 0; column < bubbles; column += 1) {
    const center = bubbleCenter(row, column)
    doc.circle(mm(center.x), mm(center.y), mm(bubbleRadius))
  }
  doc.lineWidth(0.8).stroke(INK)
}

type QrModules = ReturnType<typeof QRCode.create>['modules']

/** The level M correction survives a fold or a stain on up to 15% of the code. */
export function qrModules(payload: string): QrModules {
  return QRCode.create(payload, { errorCorrectionLevel: 'M' }).modules
}

/**
 * Drawn as squares rather than embedded as an image, so it prints as sharp as
 * the text at any size.
 */
function drawQrCode(doc: PDFKit.PDFDocument, modules: QrModules): void {
  const cell = mm(qr.size) / modules.size
  for (let row = 0; row < modules.size; row += 1) {
    for (let column = 0; column < modules.size; column += 1) {
      if (modules.get(row, column) === 1) doc.rect(mm(qr.x) + column * cell, mm(qr.y) + row * cell, cell + 0.05, cell + 0.05)
    }
  }
  doc.fill(INK)
}

/** The free margin the QR standard asks around the symbol, in modules; a reader needs it to find the code. */
const QR_QUIET_ZONE_MODULES = 4

/** The space left between the quiet zone and a label, in millimetres. */
const QR_LABEL_GAP = 1

/**
 * Where the labels above and below the QR code go, in millimetres, outside its
 * quiet zone. A module is `qr.size` divided by how many the symbol has, which
 * depends on how long the address is, so the zone is worked out from the
 * symbol printed. The QR code itself never moves: the reading of the photo
 * (#78) looks for it at `ANSWER_CARD.qr`.
 */
export function qrLabelPositions(moduleCount: number): { quietZone: number; sheetLabelBottom: number; codeTop: number } {
  const quietZone = (QR_QUIET_ZONE_MODULES * qr.size) / moduleCount
  return {
    quietZone,
    sheetLabelBottom: qr.y - quietZone - QR_LABEL_GAP,
    codeTop: qr.y + qr.size + quietZone + QR_LABEL_GAP,
  }
}

/** The number for the teacher and the code for the public lookup, which never stand in for each other. */
function drawSheetIdentity(doc: PDFKit.PDFDocument, cover: CoverContent): void {
  const modules = qrModules(cover.qrPayload)
  const { sheetLabelBottom, codeTop } = qrLabelPositions(modules.size)

  const labelHeight = useStyle(doc, STYLE.sheetLabel).heightOfString(cover.sheetLabel)
  doc.text(cover.sheetLabel, mm(qr.x), mm(sheetLabelBottom) - labelHeight, { lineBreak: false })
  drawQrCode(doc, modules)
  useStyle(doc, STYLE.code, MUTED).text(cover.codeLabel, mm(qr.x), mm(codeTop), { lineBreak: false })
}

/**
 * The first page of every sheet: who it is for, how to fill it in, and the
 * answer card, drawn from the geometry in `@correctio/domain/answer-card` that
 * the reading of #78 uses too.
 */
export function drawCover(doc: PDFKit.PDFDocument, cover: CoverContent): void {
  drawHeader(doc, cover)
  drawFrame(doc)
  drawMarkers(doc)
  drawColumnLetters(doc)
  for (const row of cover.rows) drawRow(doc, row)
  drawSheetIdentity(doc, cover)
}
