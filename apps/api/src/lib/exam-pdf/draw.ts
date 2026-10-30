import { PAGE, STYLE, type Measure, type TextStyle } from './sheet-pages'

/** The three tones of the PDF: text and marks, secondary text, and rules. */
export const INK = '#000000'
export const MUTED = '#555555'
export const RULE = '#9a9a9a'

export function useStyle(doc: PDFKit.PDFDocument, style: TextStyle, color: string = INK): PDFKit.PDFDocument {
  return doc.font(style.font).fontSize(style.size).fillColor(color)
}

/** Measures with the fonts the PDF embeds, so what a plan counts is what the page prints. */
export function measurerFor(doc: PDFKit.PDFDocument): Measure {
  return (text, style, width) => useStyle(doc, style).heightOfString(text, { width, lineGap: style.lineGap })
}

/** Where a block of text goes, and the line it must not cross. */
export interface TextBox {
  x: number
  y: number
  width: number
  /** The text is cut with an ellipsis here instead of running into what follows. */
  bottom: number
}

/**
 * Writes wrapped text and answers where it ended. The height is capped at the
 * box, so pdfkit never opens a page on its own: every page of the PDF is one
 * the plan counted, which is what keeps RF44 true.
 */
export function writeText(doc: PDFKit.PDFDocument, text: string, style: TextStyle, box: TextBox): number {
  useStyle(doc, style).text(text, box.x, box.y, {
    width: box.width,
    height: Math.max(0, box.bottom - box.y),
    lineGap: style.lineGap,
    ellipsis: true,
  })
  return doc.y
}

/** The line at the foot of every printed page, so a dropped stack of paper can be put back in order. */
export function drawFooter(doc: PDFKit.PDFDocument, text: string): void {
  useStyle(doc, STYLE.small, MUTED).text(text, 0, PAGE.footerY, { width: PAGE.width, align: 'center', lineBreak: false })
}

/** RF44: said on the page itself, so nobody takes it for a printing mistake. */
export function drawBlankPage(doc: PDFKit.PDFDocument): void {
  useStyle(doc, STYLE.small, MUTED).text(
    'Página em branco, para a próxima prova não começar no verso desta.',
    0,
    PAGE.height / 2,
    { width: PAGE.width, align: 'center', lineBreak: false },
  )
}
