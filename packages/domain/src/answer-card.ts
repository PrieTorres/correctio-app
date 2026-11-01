import type { ExamVersionLayout } from './domain';

/**
 * A point on the printed page, in millimetres from its top-left corner, with
 * `y` growing downwards. The PDF draws in these units (converted to points),
 * and the reading of the photo (#78) measures in them once the photo has been
 * straightened by the four markers.
 */
export interface CardPoint {
  x: number;
  y: number;
}

/**
 * The geometry of the answer card on the cover page of every printed sheet,
 * an A4 page in portrait.
 *
 * It is defined here, once, because two sides depend on it: the PDF of #46
 * draws the card from these numbers, and the reading of #78 looks for the marks
 * at the same numbers. A change made on one side only would make every printed
 * sheet unreadable, so neither side keeps a copy.
 *
 * The four black squares mark the corners of the bubble area. A photo is
 * straightened by mapping the centres of the squares in the photo onto
 * `markerCenters`; after that, every bubble sits at `bubbleCenter(row, column)`.
 * The layout follows the client's current sheet (`docs/prova.jpg.jpeg`): the QR
 * code to the left of a grid of bubbles A to E, one row per question.
 *
 * The space is fixed for `maxRows` questions whatever the exam has (RF15
 * allows 20), so every sheet ever printed has the same geometry. A picture of
 * the card, and how a photo is read with these numbers, are in
 * `docs/answer-card/answer-card.md`.
 */
export const ANSWER_CARD = Object.freeze({
  /**
   * Which geometry this is. Every sheet records the one it was printed with
   * (`AnswerSheet.answerCardVersion`), and the reading of #78 picks the
   * geometry by the sheet it read, so moving any number below means a new
   * version: a sheet already handed out keeps being read where its marks are.
   */
  version: 1,
  page: Object.freeze({ width: 210, height: 297 }),
  /** The outline drawn around the card, from the left margin to the right one. */
  frame: Object.freeze({ x: 15, y: 112, width: 180, height: 170 }),
  /** The side of each black square. */
  markerSize: 5,
  markerCenters: Object.freeze({
    topLeft: Object.freeze({ x: 115, y: 120 }),
    topRight: Object.freeze({ x: 185, y: 120 }),
    bottomLeft: Object.freeze({ x: 115, y: 268 }),
    bottomRight: Object.freeze({ x: 185, y: 268 }),
  }),
  maxRows: 20,
  /** The printed letters, in the order of `printedOrder` in the version layout. */
  columns: Object.freeze(['A', 'B', 'C', 'D', 'E'] as const),
  /** Where the bubble of the first question and letter A is centred. */
  firstBubble: Object.freeze({ x: 134, y: 136 }),
  columnPitch: 8,
  rowPitch: 6.5,
  bubbleRadius: 2.3,
  /** The question numbers end here, right-aligned, on the line of their row. */
  rowLabelRight: 128,
  /** The line where the letters A to E are printed above the bubbles. */
  columnLettersY: 129,
  /** The QR code, left of the grid, carrying the address of the public lookup. */
  qr: Object.freeze({ x: 25, y: 166.5, size: 55 }),
});

export type AnswerCardLetter = (typeof ANSWER_CARD.columns)[number];

/**
 * One row of the card, as printed for a version. A row with no bubbles is an
 * open-ended question: it keeps its number, so the rows still count the
 * questions as the student reads them, and it is never read.
 */
export interface AnswerCardRow {
  /** Zero-based; the card prints it as `row + 1`. */
  row: number;
  questionId: string;
  /** How many bubbles the row has, from A onwards. Zero for an open-ended question. */
  bubbles: number;
}

function requireIndex(value: number, size: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value >= size) {
    throw new RangeError(`${name} ${value} is outside the answer card (0 to ${size - 1})`);
  }
}

/** The centre of the bubble of `column` (0 is A) in `row` (0 is the first question). */
export function bubbleCenter(row: number, column: number): CardPoint {
  requireIndex(row, ANSWER_CARD.maxRows, 'Row');
  requireIndex(column, ANSWER_CARD.columns.length, 'Column');
  return {
    x: ANSWER_CARD.firstBubble.x + column * ANSWER_CARD.columnPitch,
    y: ANSWER_CARD.firstBubble.y + row * ANSWER_CARD.rowPitch,
  };
}

/** The letter printed above `column`, which is also how the teacher reads the answer. */
export function columnLetter(column: number): AnswerCardLetter {
  requireIndex(column, ANSWER_CARD.columns.length, 'Column');
  return ANSWER_CARD.columns[column] as AnswerCardLetter;
}

/**
 * The rows of the card for a version, straight from its layout: row `n` is
 * `layout.questionOrder[n]`, and bubble `k` of that row is
 * `printedOrder[k]` of the question's entry in `layout.alternativeOrder`. A
 * question without an entry there has no alternatives, so it is open-ended.
 *
 * This is the whole translation from a mark on paper to an alternative, and
 * reading it from the layout rather than from the exam is deliberate: the
 * layout is what was printed, and the exam may have changed since.
 */
export function answerCardRows(layout: ExamVersionLayout): AnswerCardRow[] {
  if (layout.questionOrder.length > ANSWER_CARD.maxRows) {
    throw new RangeError(`The answer card has room for ${ANSWER_CARD.maxRows} questions, not ${layout.questionOrder.length}`);
  }

  const printed = new Map(layout.alternativeOrder.map((entry) => [entry.questionId, entry.printedOrder.length]));
  return layout.questionOrder.map((questionId, row) => {
    const bubbles = printed.get(questionId) ?? 0;
    if (bubbles > ANSWER_CARD.columns.length) {
      throw new RangeError(`Question ${questionId} has ${bubbles} alternatives; the card prints at most ${ANSWER_CARD.columns.length}`);
    }
    return { row, questionId, bubbles };
  });
}
