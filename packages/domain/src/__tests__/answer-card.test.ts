import { describe, expect, it } from 'vitest'
import { ANSWER_CARD, answerCardRows, bubbleCenter, columnLetter, type CardPoint } from '../answer-card'
import type { ExamVersionLayout } from '../domain'

const MARGIN = 15
const { markerCenters, markerSize, bubbleRadius, frame, qr, page } = ANSWER_CARD
const markers = Object.values(markerCenters)

/** Every bubble the card can ever print: all rows, all letters. */
function everyBubble(): CardPoint[] {
  return Array.from({ length: ANSWER_CARD.maxRows }, (_, row) =>
    ANSWER_CARD.columns.map((_letter, column) => bubbleCenter(row, column)),
  ).flat()
}

function overlapsSquare(point: CardPoint, radius: number, center: CardPoint, side: number): boolean {
  const half = side / 2
  return Math.abs(point.x - center.x) < half + radius && Math.abs(point.y - center.y) < half + radius
}

/**
 * The reader straightens the photo by the four squares and then looks at fixed
 * positions, so these are the properties that keep a printed sheet readable.
 */
describe('ANSWER_CARD geometry', () => {
  it('puts the four markers on the corners of a rectangle', () => {
    expect(markerCenters.topLeft.y).toBe(markerCenters.topRight.y)
    expect(markerCenters.bottomLeft.y).toBe(markerCenters.bottomRight.y)
    expect(markerCenters.topLeft.x).toBe(markerCenters.bottomLeft.x)
    expect(markerCenters.topRight.x).toBe(markerCenters.bottomRight.x)
  })

  it('keeps every bubble strictly inside the rectangle of the markers, clear of each square', () => {
    for (const bubble of everyBubble()) {
      expect(bubble.x - bubbleRadius).toBeGreaterThan(markerCenters.topLeft.x)
      expect(bubble.x + bubbleRadius).toBeLessThan(markerCenters.topRight.x)
      expect(bubble.y - bubbleRadius).toBeGreaterThan(markerCenters.topLeft.y)
      expect(bubble.y + bubbleRadius).toBeLessThan(markerCenters.bottomLeft.y)
      for (const marker of markers) expect(overlapsSquare(bubble, bubbleRadius, marker, markerSize)).toBe(false)
    }
  })

  it('leaves a gap between neighbouring bubbles, so one mark never touches two', () => {
    expect(ANSWER_CARD.columnPitch).toBeGreaterThan(2 * bubbleRadius + 1)
    expect(ANSWER_CARD.rowPitch).toBeGreaterThan(2 * bubbleRadius + 1)
  })

  it('prints the letters between the top markers and the first row', () => {
    expect(ANSWER_CARD.columnLettersY).toBeGreaterThan(markerCenters.topLeft.y + markerSize / 2)
    expect(ANSWER_CARD.columnLettersY).toBeLessThan(ANSWER_CARD.firstBubble.y - bubbleRadius)
  })

  it('ends the question numbers before the first bubble', () => {
    expect(ANSWER_CARD.rowLabelRight).toBeLessThan(ANSWER_CARD.firstBubble.x - bubbleRadius)
    expect(ANSWER_CARD.rowLabelRight).toBeGreaterThan(markerCenters.topLeft.x + markerSize / 2)
  })

  it('keeps the card inside the printable margins of an A4 page', () => {
    expect(frame.x).toBeGreaterThanOrEqual(MARGIN)
    expect(frame.y + frame.height).toBeLessThanOrEqual(page.height - MARGIN)
    expect(frame.x + frame.width).toBeLessThanOrEqual(page.width - MARGIN)
  })

  it('keeps the markers inside the outline of the card', () => {
    for (const marker of markers) {
      expect(marker.x - markerSize / 2).toBeGreaterThan(frame.x)
      expect(marker.x + markerSize / 2).toBeLessThan(frame.x + frame.width)
      expect(marker.y - markerSize / 2).toBeGreaterThan(frame.y)
      expect(marker.y + markerSize / 2).toBeLessThan(frame.y + frame.height)
    }
  })

  it('puts the QR code inside the card and left of the markers, where it never covers a bubble', () => {
    expect(qr.x).toBeGreaterThan(frame.x)
    expect(qr.y).toBeGreaterThan(frame.y)
    expect(qr.y + qr.size).toBeLessThan(frame.y + frame.height)
    expect(qr.x + qr.size).toBeLessThan(markerCenters.topLeft.x - markerSize / 2)
  })
})

describe('bubbleCenter', () => {
  it('starts at the first bubble and steps by the pitches', () => {
    expect(bubbleCenter(0, 0)).toEqual(ANSWER_CARD.firstBubble)
    expect(bubbleCenter(2, 3)).toEqual({
      x: ANSWER_CARD.firstBubble.x + 3 * ANSWER_CARD.columnPitch,
      y: ANSWER_CARD.firstBubble.y + 2 * ANSWER_CARD.rowPitch,
    })
  })

  it('refuses a row or a letter the card does not have', () => {
    expect(() => bubbleCenter(ANSWER_CARD.maxRows, 0)).toThrow(RangeError)
    expect(() => bubbleCenter(-1, 0)).toThrow(RangeError)
    expect(() => bubbleCenter(0, 5)).toThrow(RangeError)
    expect(() => bubbleCenter(0.5, 0)).toThrow(RangeError)
  })
})

describe('columnLetter', () => {
  it('names the columns A to E', () => {
    expect([0, 1, 2, 3, 4].map(columnLetter)).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  it('refuses a sixth letter', () => {
    expect(() => columnLetter(5)).toThrow(RangeError)
  })
})

describe('answerCardRows', () => {
  const layout: ExamVersionLayout = {
    questionOrder: ['q-derivative', 'q-essay', 'q-limits'],
    alternativeOrder: [
      { questionId: 'q-limits', printedOrder: ['l-b', 'l-a', 'l-c', 'l-d', 'l-e'] },
      { questionId: 'q-derivative', printedOrder: ['d-a', 'd-b'] },
    ],
  }

  /** Row n is the n-th printed question, and the bubbles count what was printed for it. */
  it('follows the printed order of the version', () => {
    expect(answerCardRows(layout)).toEqual([
      { row: 0, questionId: 'q-derivative', bubbles: 2 },
      { row: 1, questionId: 'q-essay', bubbles: 0 },
      { row: 2, questionId: 'q-limits', bubbles: 5 },
    ])
  })

  it('refuses a version with more questions than the card has rows', () => {
    const questionOrder = Array.from({ length: ANSWER_CARD.maxRows + 1 }, (_, index) => `q${index}`)

    expect(() => answerCardRows({ questionOrder, alternativeOrder: [] })).toThrow(RangeError)
  })

  it('refuses a question with more alternatives than the card has letters', () => {
    const printedOrder = ['a', 'b', 'c', 'd', 'e', 'f']

    expect(() => answerCardRows({ questionOrder: ['q'], alternativeOrder: [{ questionId: 'q', printedOrder }] })).toThrow(
      RangeError,
    )
  })
})
