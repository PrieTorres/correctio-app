import { ANSWER_CARD, SHEET_READING, type ExamVersionLayout } from '@correctio/domain'
import { findMarker } from './find-marker'
import { toGrey, type GreyImage } from './grey-image'
import { matchSheet, type SheetWithCode } from './identify-sheet'
import { homography, project, type Homography, type Point, type Quad } from './perspective'
import { decodeQrCodes, type PixelImage } from './qr-decoder'
import { readMarks, type ReadAnswer } from './read-marks'

/** The outcomes live in `@correctio/domain`, where the API and the web app read them too. */
export { SHEET_READING } from '@correctio/domain'

export type SheetReading<Sheet> =
  | { status: typeof SHEET_READING.READ; sheet: Sheet; answers: ReadAnswer[] }
  | { status: typeof SHEET_READING.QR_NOT_RECOGNIZED }
  | { status: typeof SHEET_READING.READ_FAILED; sheet: Sheet }

export interface ReadSheetOptions<Sheet> {
  /** The sheets of the application being graded; a code of any other sheet is not recognized. */
  sheets: readonly Sheet[]
  /** The layout of the version the sheet was printed from, which turns a row and a letter into an alternative. */
  layoutOf: (sheet: Sheet) => ExamVersionLayout | undefined
}

const { qr, markerCenters, markerSize } = ANSWER_CARD

/** The QR Code on the card, its outer corners in millimetres, named as the symbol names them. */
const CARD_QR: Quad = {
  topLeft: { x: qr.x, y: qr.y },
  topRight: { x: qr.x + qr.size, y: qr.y },
  bottomRight: { x: qr.x + qr.size, y: qr.y + qr.size },
  bottomLeft: { x: qr.x, y: qr.y + qr.size },
}

const MARKERS = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const

/** The side of a marker on the photo, in pixels, around where the card puts it. */
function markerSideOnPhoto(toPhoto: Homography, center: Point): number {
  const half = markerSize / 2
  const from = project(toPhoto, { x: center.x - half, y: center.y })
  const to = project(toPhoto, { x: center.x + half, y: center.y })
  return Math.hypot(to.x - from.x, to.y - from.y)
}

/**
 * The four corner squares on the photo, or `null` if any is missing.
 *
 * The QR Code gives a first map of the card, good enough to say where each
 * square should be, and which way up the card is: a sheet photographed upside
 * down still has its top-left square where the QR Code's top-left says. Each
 * square is then looked for only around that spot.
 */
function findMarkers(image: GreyImage, roughly: Homography): Quad | null {
  const found: Partial<Record<(typeof MARKERS)[number], Point>> = {}
  for (const corner of MARKERS) {
    const center = markerCenters[corner]
    const point = findMarker(image, project(roughly, center), markerSideOnPhoto(roughly, center))
    if (point === null) return null
    found[corner] = point
  }
  const { topLeft, topRight, bottomRight, bottomLeft } = found
  return topLeft && topRight && bottomRight && bottomLeft ? { topLeft, topRight, bottomRight, bottomLeft } : null
}

/**
 * The straightened map from the card to the photo, from the four corner
 * squares. They surround the bubbles, so the bubbles are interpolated between
 * them, which is more precise than extrapolating from the QR Code beside them.
 */
function straighten(image: GreyImage, qrCorners: Quad): Homography | null {
  const roughly = homography(CARD_QR, qrCorners)
  const markers = roughly === null ? null : findMarkers(image, roughly)
  return markers === null ? null : homography(markerCenters, markers)
}

/**
 * Reads a photographed answer sheet (RF27): which sheet it is, from the QR
 * Code, and the alternative marked in each objective question, from the
 * bubbles. The same in the browser and on the server (ADR-006): pixels in, the
 * reading out.
 */
export async function readSheet<Sheet extends SheetWithCode>(image: PixelImage, { sheets, layoutOf }: ReadSheetOptions<Sheet>): Promise<SheetReading<Sheet>> {
  const identified = matchSheet(await decodeQrCodes(image), sheets)
  if (identified === null) return { status: SHEET_READING.QR_NOT_RECOGNIZED }

  const { sheet } = identified
  const layout = layoutOf(sheet)
  if (layout === undefined) return { status: SHEET_READING.READ_FAILED, sheet }

  const grey = toGrey(image)
  const toPhoto = straighten(grey, identified.qr.corners)
  if (toPhoto === null) return { status: SHEET_READING.READ_FAILED, sheet }

  return { status: SHEET_READING.READ, sheet, answers: readMarks(grey, toPhoto, layout) }
}
