import { ANSWER_CARD, bubbleCenter } from '@correctio/domain'
import QRCode from 'qrcode'
import type { PixelImage } from '../qr-decoder'
import { boxBlur, gaussian, seededRandom, toPixels } from './synthetic-photo'

/** What is printed and marked on the card being photographed. */
export interface PrintedCard {
  /** What the QR Code holds, or `null` for a card without one. */
  qrText: string | null
  /** How many bubbles each row has, from the first question; 0 is an open-ended question. */
  bubbles: readonly number[]
  /** The columns the student filled in, by row. */
  marks: Readonly<Record<number, readonly number[]>>
  /** A corner square hidden, as by a finger or a fold. */
  coveredMarker?: keyof typeof ANSWER_CARD.markerCenters
}

/** How the phone saw the card. */
export interface Camera {
  /** Degrees the sheet is turned on the table. */
  angle?: number
  /** How much nearer the bottom of the photo is than the top, from 0 (straight above). */
  tilt?: number
  /** Standard deviation of the sensor noise, in grey levels. */
  noise?: number
  /** How much darker the right side is, from 0 to 1. */
  shade?: number
  /** Passes of a 3 by 3 box blur. */
  blur?: number
}

const WIDTH = 1000
const HEIGHT = 1400
/** Pixels per millimetre: about 97 dpi, far below a phone photo, so a pass here is a conservative one. */
const SCALE = 3.8

const PAPER = 235
const TABLE = 95
const INK = 25
const PEN = 50
const OUTLINE = 110
const TEXT = 70
const FRAME_LINE = 160

/** A 3 by 3 matrix, row by row. */
type Matrix = readonly [number, number, number, number, number, number, number, number, number]

function multiply(a: Matrix, b: Matrix): Matrix {
  const at = (m: Matrix, row: number, column: number) => m[row * 3 + column] ?? 0
  const entry = (row: number, column: number) => at(a, row, 0) * at(b, 0, column) + at(a, row, 1) * at(b, 1, column) + at(a, row, 2) * at(b, 2, column)
  return [entry(0, 0), entry(0, 1), entry(0, 2), entry(1, 0), entry(1, 1), entry(1, 2), entry(2, 0), entry(2, 1), entry(2, 2)]
}

/** The inverse by the adjugate: independent of the reader's own solver, which is what this camera tests. */
function invert([a, b, c, d, e, f, g, h, i]: Matrix): Matrix {
  const k = 1 / (a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g))
  return [
    (e * i - f * h) * k,
    (c * h - b * i) * k,
    (b * f - c * e) * k,
    (f * g - d * i) * k,
    (a * i - c * g) * k,
    (c * d - a * f) * k,
    (d * h - e * g) * k,
    (b * g - a * h) * k,
    (a * e - b * d) * k,
  ]
}

function apply(m: Matrix, x: number, y: number): { x: number; y: number } {
  const w = (m[6] ?? 0) * x + (m[7] ?? 0) * y + (m[8] ?? 1)
  return { x: ((m[0] ?? 0) * x + (m[1] ?? 0) * y + (m[2] ?? 0)) / w, y: ((m[3] ?? 0) * x + (m[4] ?? 0) * y + (m[5] ?? 0)) / w }
}

/** Card millimetres to photo pixels: centred on the photo, scaled, turned, then seen at a slant. */
function cameraMatrix({ angle = 0, tilt = 0 }: Camera): Matrix {
  const radians = (angle * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const toCentre: Matrix = [1, 0, -ANSWER_CARD.page.width / 2, 0, 1, -ANSWER_CARD.page.height / 2, 0, 0, 1]
  const scaleAndTurn: Matrix = [SCALE * cos, -SCALE * sin, 0, SCALE * sin, SCALE * cos, 0, 0, 0, 1]
  const slant: Matrix = [1, 0, 0, 0, 1, 0, 0, -tilt / (HEIGHT / 2), 1]
  const toPhoto: Matrix = [1, 0, WIDTH / 2, 0, 1, HEIGHT / 2, 0, 0, 1]
  return multiply(toPhoto, multiply(slant, multiply(scaleAndTurn, toCentre)))
}

function inSquare(x: number, y: number, center: { x: number; y: number }, half: number): boolean {
  return Math.abs(x - center.x) <= half && Math.abs(y - center.y) <= half
}

function qrInk(x: number, y: number, modules: QRCode.BitMatrix | null): boolean {
  if (modules === null) return false
  const cell = ANSWER_CARD.qr.size / modules.size
  const row = Math.floor((y - ANSWER_CARD.qr.y) / cell)
  const column = Math.floor((x - ANSWER_CARD.qr.x) / cell)
  return row >= 0 && column >= 0 && row < modules.size && column < modules.size && modules.get(row, column) === 1
}

/** A bubble's outline, or the student's pen inside it. */
function bubbleInk(x: number, y: number, center: { x: number; y: number }, marked: boolean): number | undefined {
  const distance = Math.hypot(x - center.x, y - center.y)
  if (marked && distance <= ANSWER_CARD.bubbleRadius * 0.85) return PEN
  return Math.abs(distance - ANSWER_CARD.bubbleRadius) <= 0.15 ? OUTLINE : undefined
}

/** The printed question number at the start of a row and the letters above the first one, drawn as blocks of text. */
function labelInk(x: number, y: number, row: number): boolean {
  const rowY = bubbleCenter(row, 0).y
  const number = x >= 125.5 && x <= ANSWER_CARD.rowLabelRight && Math.abs(y - rowY) <= 1.2
  const letters = row === 0 && Math.abs(y - ANSWER_CARD.columnLettersY) <= 1.2 && ANSWER_CARD.columns.some((_, column) => Math.abs(x - bubbleCenter(0, column).x) <= 1)
  return number || letters
}

/** One row of the card: its labels, its bubbles and what the student marked in it. */
function rowInk(x: number, y: number, card: PrintedCard, row: number): number | undefined {
  if (labelInk(x, y, row)) return TEXT
  const marked = card.marks[row] ?? []
  for (let column = 0; column < (card.bubbles[row] ?? 0); column += 1) {
    const ink = bubbleInk(x, y, bubbleCenter(row, column), marked.includes(column))
    if (ink !== undefined) return ink
  }
  return undefined
}

function gridInk(x: number, y: number, card: PrintedCard): number | undefined {
  for (const row of card.bubbles.keys()) {
    const ink = rowInk(x, y, card, row)
    if (ink !== undefined) return ink
  }
  return undefined
}

function markerInk(x: number, y: number, card: PrintedCard): boolean {
  const half = ANSWER_CARD.markerSize / 2
  return Object.entries(ANSWER_CARD.markerCenters).some(([corner, center]) => corner !== card.coveredMarker && inSquare(x, y, center, half))
}

function onFrame(x: number, y: number): boolean {
  const { frame } = ANSWER_CARD
  const near = (value: number, edge: number) => Math.abs(value - edge) <= 0.15
  const withinX = x >= frame.x && x <= frame.x + frame.width
  const withinY = y >= frame.y && y <= frame.y + frame.height
  return ((near(x, frame.x) || near(x, frame.x + frame.width)) && withinY) || ((near(y, frame.y) || near(y, frame.y + frame.height)) && withinX)
}

/** The grey level of the printed and marked card at a point, in millimetres. */
function cardAt(x: number, y: number, card: PrintedCard, modules: QRCode.BitMatrix | null): number {
  if (x < 0 || y < 0 || x > ANSWER_CARD.page.width || y > ANSWER_CARD.page.height) return TABLE
  if (markerInk(x, y, card) || qrInk(x, y, modules)) return INK
  return gridInk(x, y, card) ?? (onFrame(x, y) ? FRAME_LINE : PAPER)
}

/** A phone photo of the card, traced pixel by pixel back to the page through the camera. */
export function photographCard(card: PrintedCard, camera: Camera = {}, seed = 11): PixelImage {
  const toCard = invert(cameraMatrix(camera))
  const modules = card.qrText === null ? null : QRCode.create(card.qrText, { errorCorrectionLevel: 'M' }).modules
  const random = seededRandom(seed)
  const { noise = 0, shade = 0, blur = 0 } = camera
  let grey: Float32Array = new Float32Array(WIDTH * HEIGHT)
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const point = apply(toCard, x + 0.5, y + 0.5)
      grey[y * WIDTH + x] = cardAt(point.x, point.y, card, modules) * (1 - shade * (x / WIDTH)) + noise * gaussian(random)
    }
  }
  for (let pass = 0; pass < blur; pass += 1) grey = boxBlur(grey, WIDTH, HEIGHT)
  return toPixels(grey, WIDTH, HEIGHT)
}
