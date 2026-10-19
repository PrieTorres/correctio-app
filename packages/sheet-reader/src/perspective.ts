/** A point on a plane: millimetres on the printed card, or pixels on the photo. */
export interface Point {
  x: number
  y: number
}

/** Four corners of a figure, named as on the printed card, whichever way the photo turned it. */
export interface Quad {
  topLeft: Point
  topRight: Point
  bottomRight: Point
  bottomLeft: Point
}

/**
 * How a flat sheet on the card maps onto the photo: a homography, the eight
 * free entries of its 3 by 3 matrix with the last one fixed at 1. A phone held
 * at a slant shrinks the far edge of the sheet, which a rotation and a scale
 * cannot express; this can, and four points determine it.
 */
export type Homography = readonly [number, number, number, number, number, number, number, number]

const CORNERS = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const

/** Eight unknowns, and each row of the system carries its right-hand side after them. */
const UNKNOWNS = 8
const ROW_LENGTH = UNKNOWNS + 1

/**
 * Below this, the corners are collinear or repeated: either no map exists, or
 * the one that does flattens the plane onto a line, which is no photo of a card.
 */
const SINGULAR = 1e-10

/** Where `point` lands under `map`. */
export function project(map: Homography, point: Point): Point {
  const [a, b, c, d, e, f, g, h] = map
  const w = g * point.x + h * point.y + 1
  return { x: (a * point.x + b * point.y + c) / w, y: (d * point.x + e * point.y + f) / w }
}

/** The augmented system, row after row in one array, so every entry is read through one place. */
class LinearSystem {
  private readonly entries = new Float64Array(UNKNOWNS * ROW_LENGTH)

  constructor(rows: readonly (readonly number[])[]) {
    rows.forEach((row, index) => this.entries.set(row, index * ROW_LENGTH))
  }

  get(row: number, column: number): number {
    return this.entries[row * ROW_LENGTH + column] ?? 0
  }

  swapRows(first: number, second: number): void {
    const copy = this.entries.slice(first * ROW_LENGTH, (first + 1) * ROW_LENGTH)
    this.entries.copyWithin(first * ROW_LENGTH, second * ROW_LENGTH, (second + 1) * ROW_LENGTH)
    this.entries.set(copy, second * ROW_LENGTH)
  }

  /** Subtracts `factor` times row `source` from row `target`. */
  subtractRow(target: number, source: number, factor: number): void {
    for (let column = 0; column < ROW_LENGTH; column += 1) {
      this.entries[target * ROW_LENGTH + column] = this.get(target, column) - factor * this.get(source, column)
    }
  }
}

/** The two equations one pair of corners adds: where `from` must land, as `to`. */
function equationsFor(from: Point, to: Point): number[][] {
  return [
    [from.x, from.y, 1, 0, 0, 0, -from.x * to.x, -from.y * to.x, to.x],
    [0, 0, 0, from.x, from.y, 1, -from.x * to.y, -from.y * to.y, to.y],
  ]
}

/** The row, from `column` down, with the largest entry in `column`: dividing by it keeps the rounding small. */
function pivotRow(system: LinearSystem, column: number): number {
  let best = column
  for (let row = column + 1; row < UNKNOWNS; row += 1) {
    if (Math.abs(system.get(row, column)) > Math.abs(system.get(best, column))) best = row
  }
  return best
}

/**
 * Solves the system by Gauss-Jordan elimination with partial pivoting. Eight
 * unknowns, so writing it out costs less than any library.
 */
function solve(system: LinearSystem): Homography | null {
  for (let column = 0; column < UNKNOWNS; column += 1) {
    system.swapRows(column, pivotRow(system, column))
    const pivot = system.get(column, column)
    if (Math.abs(pivot) < SINGULAR) return null
    for (let row = 0; row < UNKNOWNS; row += 1) {
      if (row !== column) system.subtractRow(row, column, system.get(row, column) / pivot)
    }
  }
  const value = (index: number) => system.get(index, UNKNOWNS) / system.get(index, index)
  return [value(0), value(1), value(2), value(3), value(4), value(5), value(6), value(7)]
}

/** Whether the map squashes the plane onto a line: its 3 by 3 matrix has no inverse. */
function flattens([a, b, c, d, e, f, g, h]: Homography): boolean {
  return Math.abs(a * (e - f * h) - b * (d - f * g) + c * (d * h - e * g)) < SINGULAR
}

/**
 * The map that sends each corner of `from` onto the same corner of `to`, or
 * `null` when the corners do not form a quadrilateral, such as three of them
 * found on one line.
 */
export function homography(from: Quad, to: Quad): Homography | null {
  const map = solve(new LinearSystem(CORNERS.flatMap((corner) => equationsFor(from[corner], to[corner]))))
  return map === null || flattens(map) ? null : map
}
