import { levelAt, type GreyImage } from './grey-image'
import type { Point } from './perspective'

/**
 * How far around the predicted centre a marker is looked for, in marker
 * sides. Wide enough for a sheet that bends a little, narrow enough that the
 * three squares of the QR Code's own corners, also 5 mm, never fall inside.
 */
const SEARCH_SIDES = 4

/** Below this difference between ink and paper there is no square to find, only shadow. */
const MIN_CONTRAST = 60

/** Accepted area of a blob, in squares of the expected side: perspective shrinks or grows it, text is far smaller. */
const AREA_RANGE = { min: 0.35, max: 2.2 } as const

/** A filled square covers most of its bounding box; a letter or a line does not. */
const MIN_FILL = 0.6
const MAX_ASPECT = 1.8

/** The search window, clipped to the photo. */
interface Window {
  left: number
  top: number
  right: number
  bottom: number
}

/** One connected patch of dark pixels. */
interface Blob {
  area: number
  sumX: number
  sumY: number
  minX: number
  maxX: number
  minY: number
  maxY: number
}

function windowAround(image: GreyImage, center: Point, side: number): Window {
  const reach = Math.ceil((side * SEARCH_SIDES) / 2)
  return {
    left: Math.max(0, Math.round(center.x) - reach),
    top: Math.max(0, Math.round(center.y) - reach),
    right: Math.min(image.width - 1, Math.round(center.x) + reach),
    bottom: Math.min(image.height - 1, Math.round(center.y) + reach),
  }
}

/** Halfway between the darkest and the lightest of the window, or `undefined` when they are too close to tell ink from paper. */
function inkThreshold(image: GreyImage, area: Window): number | undefined {
  let darkest = 255
  let lightest = 0
  for (let y = area.top; y <= area.bottom; y += 1) {
    for (let x = area.left; x <= area.right; x += 1) {
      const level = levelAt(image, x, y) ?? 255
      darkest = Math.min(darkest, level)
      lightest = Math.max(lightest, level)
    }
  }
  return lightest - darkest < MIN_CONTRAST ? undefined : (darkest + lightest) / 2
}

/** Grows one blob from a dark pixel, marking what it takes so no pixel joins two blobs. */
function growBlob(isInk: (x: number, y: number) => boolean, taken: Set<number>, start: Point, width: number): Blob {
  const blob: Blob = { area: 0, sumX: 0, sumY: 0, minX: start.x, maxX: start.x, minY: start.y, maxY: start.y }
  const pending: Point[] = [start]
  taken.add(start.y * width + start.x)
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    blob.area += 1
    blob.sumX += next.x
    blob.sumY += next.y
    blob.minX = Math.min(blob.minX, next.x)
    blob.maxX = Math.max(blob.maxX, next.x)
    blob.minY = Math.min(blob.minY, next.y)
    blob.maxY = Math.max(blob.maxY, next.y)
    for (const neighbour of [{ x: next.x + 1, y: next.y }, { x: next.x - 1, y: next.y }, { x: next.x, y: next.y + 1 }, { x: next.x, y: next.y - 1 }]) {
      const key = neighbour.y * width + neighbour.x
      if (taken.has(key) || !isInk(neighbour.x, neighbour.y)) continue
      taken.add(key)
      pending.push(neighbour)
    }
  }
  return blob
}

/** Every patch of dark pixels inside the window. */
function darkBlobs(image: GreyImage, area: Window, threshold: number): Blob[] {
  const isInk = (x: number, y: number) =>
    x >= area.left && x <= area.right && y >= area.top && y <= area.bottom && (levelAt(image, x, y) ?? 255) < threshold
  const taken = new Set<number>()
  const blobs: Blob[] = []
  for (let y = area.top; y <= area.bottom; y += 1) {
    for (let x = area.left; x <= area.right; x += 1) {
      if (!taken.has(y * image.width + x) && isInk(x, y)) blobs.push(growBlob(isInk, taken, { x, y }, image.width))
    }
  }
  return blobs
}

/** A solid, roughly square patch about the size of a marker. */
function looksLikeMarker(blob: Blob, side: number): boolean {
  const width = blob.maxX - blob.minX + 1
  const height = blob.maxY - blob.minY + 1
  const expected = side * side
  return (
    blob.area >= expected * AREA_RANGE.min &&
    blob.area <= expected * AREA_RANGE.max &&
    blob.area / (width * height) >= MIN_FILL &&
    Math.max(width, height) / Math.min(width, height) <= MAX_ASPECT
  )
}

const centroid = (blob: Blob): Point => ({ x: blob.sumX / blob.area, y: blob.sumY / blob.area })

/**
 * The centre of the black corner square nearest to where the card says it is,
 * or `null` when nothing there looks like one: a corner out of the photo,
 * covered by a finger, or too dark to tell.
 *
 * `side` is the expected side of the square in pixels at that spot. Only a
 * window around `predicted` is searched, which is what keeps the squares of
 * the QR Code, the same size as the markers, out of the answer.
 */
export function findMarker(image: GreyImage, predicted: Point, side: number): Point | null {
  const area = windowAround(image, predicted, side)
  const threshold = inkThreshold(image, area)
  if (threshold === undefined) return null

  const candidates = darkBlobs(image, area, threshold).filter((blob) => looksLikeMarker(blob, side)).map(centroid)
  const distance = (point: Point) => Math.hypot(point.x - predicted.x, point.y - predicted.y)
  return candidates.reduce<Point | null>((best, point) => (best === null || distance(point) < distance(best) ? point : best), null)
}
