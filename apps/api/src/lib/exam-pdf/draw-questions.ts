import { MUTED, RULE, useStyle, writeText } from './draw'
import { PAGE, QUESTION, STYLE, TEXT_WIDTH, type MeasuredQuestion } from './sheet-pages'

const TEXT_LEFT = PAGE.left + QUESTION.numberWidth

const box = (y: number) => ({ x: TEXT_LEFT, y, width: TEXT_WIDTH, bottom: PAGE.contentBottom })

/** Ruled lines where an open-ended question is answered, as tall as the plan measured. */
function drawAnswerLines(doc: PDFKit.PDFDocument, top: number): void {
  for (let line = 1; line <= QUESTION.answerLines; line += 1) {
    const y = top + line * QUESTION.answerLinePitch - 4
    doc.moveTo(TEXT_LEFT, y).lineTo(TEXT_LEFT + TEXT_WIDTH, y)
  }
  doc.lineWidth(0.5).stroke(RULE)
}

function drawAlternatives(doc: PDFKit.PDFDocument, { content, alternativeHeights }: MeasuredQuestion, top: number): void {
  const alternatives = content.alternatives ?? []
  let y = top
  alternatives.forEach(({ letter, text }, index) => {
    writeText(doc, `${letter}) ${text}`, STYLE.body, box(y))
    y += (alternativeHeights[index] ?? 0) + QUESTION.alternativeGap
  })
}

/**
 * One question at `top`, laid out with the heights the plan measured, so what
 * is drawn takes exactly the room `planSheetPages` gave it.
 */
function drawQuestion(doc: PDFKit.PDFDocument, measured: MeasuredQuestion, top: number): void {
  const { content } = measured
  useStyle(doc, STYLE.bodyBold).text(`${content.number}.`, PAGE.left, top, { width: QUESTION.numberWidth, lineBreak: false })
  writeText(doc, content.statement, STYLE.body, box(top))

  const scoreTop = top + measured.statementHeight + QUESTION.gap
  useStyle(doc, STYLE.small, MUTED).text(content.scoreLabel, TEXT_LEFT, scoreTop, { width: TEXT_WIDTH, align: 'right', lineBreak: false })

  const answersTop = scoreTop + measured.scoreHeight + QUESTION.gap
  if (content.alternatives === undefined) drawAnswerLines(doc, answersTop)
  else drawAlternatives(doc, measured, answersTop)
}

export function drawQuestionsPage(doc: PDFKit.PDFDocument, questions: readonly MeasuredQuestion[]): void {
  let top = PAGE.top
  for (const question of questions) {
    drawQuestion(doc, question, top)
    top += question.height
  }
}
