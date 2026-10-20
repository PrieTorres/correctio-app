import type { ExamVersionLayout } from '@correctio/domain'
import { beforeAll, describe, expect, it } from 'vitest'
import { useQrDecoderBinary } from '../qr-decoder'
import { readSheet, SHEET_READING } from '../read-sheet'
import { photographCard, type PrintedCard } from './synthetic-card'
import { localDecoderBinary } from './synthetic-photo'

const SHEET = { id: 'sheet-7', code: 'ABCDEFGHJKLMNPQRSTUVWXYZ27' }
const OTHER_APPLICATION = 'MNBVCXZLKJHGFDSAPUYTREWQ56'
const lookup = (code: string) => `https://correctio-app.web.app/r/${code}`

/**
 * Version 2 of an exam: the questions and alternatives in the printed order,
 * which is not the order of the exam. `q-essay` has no entry in
 * `alternativeOrder`, so it is open-ended and has no bubbles.
 */
const LAYOUT: ExamVersionLayout = {
  questionOrder: ['q-limits', 'q-derivative', 'q-essay', 'q-matrix', 'q-newton', 'q-series'],
  alternativeOrder: [
    { questionId: 'q-limits', printedOrder: ['lim-c', 'lim-a', 'lim-e', 'lim-b', 'lim-d'] },
    { questionId: 'q-derivative', printedOrder: ['der-b', 'der-a', 'der-d', 'der-c'] },
    { questionId: 'q-matrix', printedOrder: ['mat-a', 'mat-b', 'mat-c', 'mat-d', 'mat-e'] },
    { questionId: 'q-newton', printedOrder: ['new-d', 'new-c', 'new-b', 'new-a', 'new-e'] },
    { questionId: 'q-series', printedOrder: ['ser-e', 'ser-d', 'ser-c', 'ser-b', 'ser-a'] },
  ],
}

/** C on the first row, A on the second, nothing on the fourth, B and D on the fifth, E on the last. */
const MARKED: PrintedCard = {
  qrText: lookup(SHEET.code),
  bubbles: [5, 4, 0, 5, 5, 5],
  marks: { 0: [2], 1: [0], 4: [1, 3], 5: [4] },
}

/** The letter marked, translated through the printed order; blank and double-marked rows come back without one. */
const EXPECTED = [
  { questionId: 'q-limits', selectedAlternativeId: 'lim-e' },
  { questionId: 'q-derivative', selectedAlternativeId: 'der-b' },
  { questionId: 'q-matrix' },
  { questionId: 'q-newton' },
  { questionId: 'q-series', selectedAlternativeId: 'ser-a' },
]

const read = (card: PrintedCard, camera = {}) =>
  readSheet(photographCard(card, camera), { sheets: [SHEET], layoutOf: (sheet) => (sheet === SHEET ? LAYOUT : undefined) })

beforeAll(() => {
  useQrDecoderBinary(localDecoderBinary())
})

describe('readSheet', () => {
  it('reads the marked alternative of each objective question, through the printed order of the version', async () => {
    expect(await read(MARKED)).toEqual({ status: SHEET_READING.READ, sheet: SHEET, answers: EXPECTED })
  })

  /** The QR Code names its own corners, so the card is read the right way up however it lies on the table. */
  it.each([90, 180, 270])('reads a sheet turned %i degrees', async (angle) => {
    expect(await read(MARKED, { angle })).toEqual({ status: SHEET_READING.READ, sheet: SHEET, answers: EXPECTED })
  })

  /** Feature 8.7 of the Spec: tolerance to light, rotation and perspective. */
  it('reads a slanted, turned, noisy, unevenly lit and slightly blurred photo', async () => {
    const camera = { angle: 12, tilt: 0.2, noise: 12, shade: 0.35, blur: 1 }
    expect(await read(MARKED, camera)).toEqual({ status: SHEET_READING.READ, sheet: SHEET, answers: EXPECTED })
  })

  /** RF30: a sheet of another application, or of a PDF regenerated since, goes to manual grading. */
  it('does not recognize the QR Code of a sheet of another application', async () => {
    expect(await read({ ...MARKED, qrText: lookup(OTHER_APPLICATION) })).toEqual({ status: SHEET_READING.QR_NOT_RECOGNIZED })
  })

  it('does not recognize a card without a QR Code', async () => {
    expect(await read({ ...MARKED, qrText: null })).toEqual({ status: SHEET_READING.QR_NOT_RECOGNIZED })
  })

  /** The sheet is known, so the photo is kept for it, but no reading is better than one taken from a guessed position. */
  it('fails the reading, keeping the sheet, when a corner square is hidden', async () => {
    expect(await read({ ...MARKED, coveredMarker: 'bottomRight' })).toEqual({ status: SHEET_READING.READ_FAILED, sheet: SHEET })
  })

  it('fails the reading when the version of the sheet has no layout to translate the marks', async () => {
    const reading = await readSheet(photographCard(MARKED), { sheets: [SHEET], layoutOf: () => undefined })
    expect(reading).toEqual({ status: SHEET_READING.READ_FAILED, sheet: SHEET })
  })
})
