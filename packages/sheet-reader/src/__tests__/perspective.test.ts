import { describe, expect, it } from 'vitest'
import { homography, project, type Homography, type Point, type Quad } from '../perspective'

const square = (x: number, y: number, side: number): Quad => ({
  topLeft: { x, y },
  topRight: { x: x + side, y },
  bottomRight: { x: x + side, y: y + side },
  bottomLeft: { x, y: y + side },
})

const CORNERS = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const

function expectClose(actual: Point, expected: Point): void {
  expect(actual.x).toBeCloseTo(expected.x, 6)
  expect(actual.y).toBeCloseTo(expected.y, 6)
}

function requireMap(map: Homography | null): Homography {
  expect(map).not.toBeNull()
  return map ?? [1, 0, 0, 0, 1, 0, 0, 0]
}

describe('homography', () => {
  it('maps a figure onto itself as the identity', () => {
    const map = requireMap(homography(square(10, 20, 30), square(10, 20, 30)))
    expectClose(project(map, { x: 17, y: 41 }), { x: 17, y: 41 })
  })

  it('scales and moves, keeping the middle in the middle', () => {
    const map = requireMap(homography(square(0, 0, 10), square(100, 200, 40)))
    expectClose(project(map, { x: 5, y: 5 }), { x: 120, y: 220 })
    expectClose(project(map, { x: 2.5, y: 7.5 }), { x: 110, y: 230 })
  })

  /** A phone at a slant: the far edge shrinks, which no rotation and scale can do. */
  it('sends each corner onto the same corner of a slanted quadrilateral, and straight lines stay straight', () => {
    const slanted: Quad = { topLeft: { x: 120, y: 80 }, topRight: { x: 380, y: 95 }, bottomRight: { x: 450, y: 520 }, bottomLeft: { x: 40, y: 470 } }
    const map = requireMap(homography(square(0, 0, 100), slanted))

    for (const corner of CORNERS) expectClose(project(map, square(0, 0, 100)[corner]), slanted[corner])

    const left = project(map, { x: 0, y: 50 })
    const middle = project(map, { x: 50, y: 50 })
    const right = project(map, { x: 100, y: 50 })
    const cross = (middle.x - left.x) * (right.y - left.y) - (middle.y - left.y) * (right.x - left.x)
    expect(cross).toBeCloseTo(0, 6)
  })

  it('answers null when three corners are on one line', () => {
    const flat: Quad = { topLeft: { x: 0, y: 0 }, topRight: { x: 10, y: 0 }, bottomRight: { x: 20, y: 0 }, bottomLeft: { x: 0, y: 10 } }
    expect(homography(square(0, 0, 10), flat)).toBeNull()
  })
})
