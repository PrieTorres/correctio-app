import { paginate } from '@correctio/domain'
import type { PrintedQuestionContent } from './sheet-content'

/** PDF points per millimetre: the card is defined in millimetres, pdfkit draws in points. */
export const mm = (millimetres: number): number => (millimetres * 72) / 25.4

/** The fonts the PDF embeds, registered under these names (`render-exam-pdf.ts`). */
export const FONT = Object.freeze({ REGULAR: 'regular', BOLD: 'bold', MONO: 'mono' } as const)

export type FontName = (typeof FONT)[keyof typeof FONT]

export interface TextStyle {
  font: FontName
  size: number
  lineGap?: number
}

/** Every text of the PDF uses one of these, so measuring and drawing can never disagree. */
export const STYLE = Object.freeze({
  title: { font: FONT.BOLD, size: 16 },
  body: { font: FONT.REGULAR, size: 10.5, lineGap: 1.5 },
  bodyBold: { font: FONT.BOLD, size: 10.5, lineGap: 1.5 },
  small: { font: FONT.REGULAR, size: 8.5 },
  cardLabel: { font: FONT.BOLD, size: 8 },
  sheetLabel: { font: FONT.BOLD, size: 13 },
  code: { font: FONT.MONO, size: 7.5 },
} satisfies Record<string, TextStyle>)

/** An A4 page in points, with the area the questions flow in and the line of the footer. */
export const PAGE = Object.freeze({
  width: mm(210),
  height: mm(297),
  left: mm(20),
  top: mm(20),
  contentWidth: mm(170),
  contentBottom: mm(277),
  footerY: mm(285),
})

/** The height the questions of one page can fill. */
export const USABLE_HEIGHT = PAGE.contentBottom - PAGE.top

/** Sizes of a question block, in points. */
export const QUESTION = Object.freeze({
  numberWidth: 24,
  gap: 4,
  alternativeGap: 3,
  spacing: 14,
  answerLines: 7,
  answerLinePitch: 22,
})

/** The width the statement and the alternatives wrap in, right of the question number. */
export const TEXT_WIDTH = PAGE.contentWidth - QUESTION.numberWidth

/** How tall `text` is in `style` when wrapped at `width`; pdfkit answers it in `render-exam-pdf.ts`. */
export type Measure = (text: string, style: TextStyle, width: number) => number

/** The heights of the parts of a question block, which the drawing stacks in the same order. */
export interface MeasuredQuestion {
  content: PrintedQuestionContent
  statementHeight: number
  scoreHeight: number
  /** One per alternative; empty for an open-ended question, whose answer area has a fixed height. */
  alternativeHeights: number[]
  height: number
}

const ANSWER_AREA_HEIGHT = QUESTION.answerLines * QUESTION.answerLinePitch

export function measureQuestion(content: PrintedQuestionContent, measure: Measure): MeasuredQuestion {
  const statementHeight = measure(content.statement, STYLE.body, TEXT_WIDTH)
  const scoreHeight = measure(content.scoreLabel, STYLE.small, TEXT_WIDTH)
  const alternativeHeights = (content.alternatives ?? []).map(({ letter, text }) => measure(`${letter}) ${text}`, STYLE.body, TEXT_WIDTH))
  const answersHeight =
    content.alternatives === undefined
      ? ANSWER_AREA_HEIGHT
      : alternativeHeights.reduce((total, height) => total + height + QUESTION.alternativeGap, 0)

  return {
    content,
    statementHeight,
    scoreHeight,
    alternativeHeights,
    height: statementHeight + QUESTION.gap + scoreHeight + QUESTION.gap + answersHeight + QUESTION.spacing,
  }
}

/** One page of a printed sheet: the cover with the card, a page of questions, or the blank page of RF44. */
export type SheetPage =
  | { kind: 'COVER' }
  | { kind: 'QUESTIONS'; questions: MeasuredQuestion[] }
  | { kind: 'BLANK' }

const COVER_ID = 'cover'

/**
 * The pages of one sheet. The cover is a block as tall as a page, so it stands
 * alone on page 1 and still counts for RF44: a sheet whose cover and questions
 * end on an odd page gets the blank page, and no question is ever split across
 * pages (RF43). Both rules come from `paginate`, the one the web app shares.
 */
export function planSheetPages(questions: readonly MeasuredQuestion[]): SheetPage[] {
  const byId = new Map(questions.map((question) => [question.content.id, question]))
  const blocks = [{ id: COVER_ID, height: USABLE_HEIGHT }, ...questions.map((question) => ({ id: question.content.id, height: question.height }))]

  return paginate(blocks, USABLE_HEIGHT).pages.map((page): SheetPage => {
    if (page.length === 0) return { kind: 'BLANK' }
    if (page[0]?.id === COVER_ID) return { kind: 'COVER' }
    return { kind: 'QUESTIONS', questions: page.map((block) => byId.get(block.id)).filter((question) => question !== undefined) }
  })
}
