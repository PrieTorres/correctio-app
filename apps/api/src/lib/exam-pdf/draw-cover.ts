import { ANSWER_CARD, bubbleCenter, columnLetter, type AnswerCardRow } from '@correctio/domain'
import QRCode from 'qrcode'
import { INK, MUTED, RULE, useStyle, writeText } from './draw'
import type { CoverContent } from './sheet-content'
import { mm, STYLE } from './sheet-pages'

const { frame, markerSize, markerCenters, qr, bubbleRadius } = ANSWER_CARD

/** The header and the instructions use the width of the card, above it. */
const HEADER_LEFT = mm(frame.x)
const HEADER_WIDTH = mm(frame.width)
const HEADER_TOP = mm(15)
const HEADER_BOTTOM = mm(frame.y - 4)

/** What a student without a printed name fills in, long enough for a full name. */
const BLANK_IDENTITY = 'Nome: _______________________________________________   Matrícula: ________________'

function drawHeader(doc: PDFKit.PDFDocument, cover: CoverContent): void {
  const box = (y: number) => ({ x: HEADER_LEFT, y, width: HEADER_WIDTH, bottom: HEADER_BOTTOM })

  let y = writeText(doc, cover.title, STYLE.title, box(HEADER_TOP)) + 4
  y = writeText(doc, cover.classLine, STYLE.body, box(y)) + 2
  y = writeText(doc, cover.sittingLine, STYLE.body, box(y)) + 10
  y =
    cover.identity.kind === 'STUDENT'
      ? writeText(doc, cover.identity.text, STYLE.bodyBold, box(y))
      : writeText(doc, BLANK_IDENTITY, STYLE.body, box(y))

  y = writeText(doc, 'Como preencher o cartão-resposta', STYLE.bodyBold, box(y + 14)) + 3
  for (const line of cover.instructions) y = writeText(doc, `•  ${line}`, STYLE.small, box(y)) + 2
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

/**
 * Drawn as squares rather than embedded as an image, so it prints as sharp as
 * the text at any size. The level M correction survives a fold or a stain on
 * up to 15% of the code.
 */
function drawQrCode(doc: PDFKit.PDFDocument, payload: string): void {
  const { modules } = QRCode.create(payload, { errorCorrectionLevel: 'M' })
  const cell = mm(qr.size) / modules.size
  for (let row = 0; row < modules.size; row += 1) {
    for (let column = 0; column < modules.size; column += 1) {
      if (modules.get(row, column) === 1) doc.rect(mm(qr.x) + column * cell, mm(qr.y) + row * cell, cell + 0.05, cell + 0.05)
    }
  }
  doc.fill(INK)
}

/** The number for the teacher and the code for the public lookup, which never stand in for each other. */
function drawSheetIdentity(doc: PDFKit.PDFDocument, cover: CoverContent): void {
  useStyle(doc, STYLE.sheetLabel).text(cover.sheetLabel, mm(qr.x), mm(qr.y - 12), { lineBreak: false })
  drawQrCode(doc, cover.qrPayload)
  useStyle(doc, STYLE.code, MUTED).text(cover.codeLabel, mm(qr.x), mm(qr.y + qr.size + 4), { lineBreak: false })
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
