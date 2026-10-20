import { ANSWER_CARD, answerCardRows, bubbleCenter, type AnswerCardRow, type ExamVersionLayout } from '@correctio/domain'
import { meanInDisk, type GreyImage } from './grey-image'
import { project, type Homography, type Point } from './perspective'

/**
 * One objective question as read from the card, in the shape the grading
 * review takes (`MarkedAnswer`): the alternative is absent when the row was
 * left blank or holds more than one mark, and the teacher decides (RF28).
 */
export interface ReadAnswer {
  questionId: string
  selectedAlternativeId?: string
}

/**
 * The part of each bubble that is measured, as a share of its radius. The
 * printed outline sits at the radius and would count as ink; a pen mark fills
 * the middle first.
 */
const INNER_SHARE = 0.55

/** The paper between two bubbles is measured over a disk this wide, in millimetres. */
const PAPER_RADIUS = 0.8

/**
 * How much darker than the paper around it a bubble must be to count as
 * marked: 0 is untouched paper, 1 is black. A filled bubble reads above 0.6 on
 * the test photos, an empty one below 0.1.
 */
const MARKED_DARKNESS = 0.35

/** Millimetres to pixels around `point`, measured along the row so perspective is taken into account. */
function pixelsPerMillimetre(toPhoto: Homography, point: Point): number {
  const here = project(toPhoto, point)
  const across = project(toPhoto, { x: point.x + 1, y: point.y })
  return Math.hypot(across.x - here.x, across.y - here.y)
}

/** The brightness of the blank paper of the row: the median of the gaps between its bubbles and after the last one. */
function paperLevel(image: GreyImage, toPhoto: Homography, row: AnswerCardRow): number | undefined {
  const scale = pixelsPerMillimetre(toPhoto, bubbleCenter(row.row, 0))
  const gaps = Array.from({ length: row.bubbles }, (_, column) => {
    const center = bubbleCenter(row.row, column)
    return meanInDisk(image, project(toPhoto, { x: center.x + ANSWER_CARD.columnPitch / 2, y: center.y }), PAPER_RADIUS * scale)
  }).filter((level) => level !== undefined)
  const sorted = gaps.toSorted((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/** How dark each bubble of the row is against the paper, from 0 (untouched) to 1 (black). */
function bubbleDarkness(image: GreyImage, toPhoto: Homography, row: AnswerCardRow, paper: number): number[] {
  const scale = pixelsPerMillimetre(toPhoto, bubbleCenter(row.row, 0))
  return Array.from({ length: row.bubbles }, (_, column) => {
    const level = meanInDisk(image, project(toPhoto, bubbleCenter(row.row, column)), INNER_SHARE * ANSWER_CARD.bubbleRadius * scale)
    return level === undefined ? 0 : Math.max(0, (paper - level) / paper)
  })
}

/** The one marked column of the row, or `undefined` when there is none or more than one. */
function markedColumn(darkness: readonly number[]): number | undefined {
  const marked = darkness.flatMap((value, column) => (value >= MARKED_DARKNESS ? [column] : []))
  return marked.length === 1 ? marked[0] : undefined
}

/**
 * The answers marked on a straightened card. `toPhoto` sends a point of the
 * card, in millimetres, to its pixel on the photo. Each row is translated by
 * the version's layout (`answerCardRows`): row `n` is `questionOrder[n]`, and
 * the `k`-th bubble is `printedOrder[k]` of that question. Open-ended rows have
 * no bubbles and are left out.
 */
export function readMarks(image: GreyImage, toPhoto: Homography, layout: ExamVersionLayout): ReadAnswer[] {
  const printed = new Map(layout.alternativeOrder.map((entry) => [entry.questionId, entry.printedOrder]))

  return answerCardRows(layout)
    .filter((row) => row.bubbles > 0)
    .map((row) => {
      const paper = paperLevel(image, toPhoto, row)
      const column = paper === undefined ? undefined : markedColumn(bubbleDarkness(image, toPhoto, row, paper))
      const selectedAlternativeId = column === undefined ? undefined : printed.get(row.questionId)?.[column]
      return selectedAlternativeId === undefined ? { questionId: row.questionId } : { questionId: row.questionId, selectedAlternativeId }
    })
}
