import { describe, expect, it } from 'vitest'
import { findMarker } from '../find-marker'
import { levelAt, meanInDisk, toGrey, type GreyImage } from '../grey-image'

const PAPER = 230
const INK = 20

/** A grey page of `width` by `height`, with ink wherever `inked` says. */
function page(width: number, height: number, inked: (x: number, y: number) => boolean): GreyImage {
  const levels = new Float32Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) levels[y * width + x] = inked(x, y) ? INK : PAPER
  }
  return { levels, width, height }
}

const square = (left: number, top: number, side: number) => (x: number, y: number) => x >= left && x < left + side && y >= top && y < top + side

describe('toGrey', () => {
  it('weighs the channels the way the eye does, so a blue pen reads as dark as it looks', () => {
    const pixels = { data: new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 255, 255]), width: 2, height: 1 }
    const grey = toGrey(pixels)
    expect(levelAt(grey, 0, 0)).toBeCloseTo(255, 3)
    expect(levelAt(grey, 1, 0)).toBeCloseTo(0.114 * 255, 3)
  })
})

describe('meanInDisk', () => {
  const half = page(20, 20, (x) => x < 10)

  it('averages the pixels of the disk', () => {
    expect(meanInDisk(half, { x: 3, y: 10 }, 2)).toBe(INK)
    expect(meanInDisk(half, { x: 10, y: 10 }, 3)).toBeGreaterThan(INK)
  })

  it('counts only what is on the photo, and nothing when the disk is off it', () => {
    expect(meanInDisk(half, { x: 0, y: 0 }, 2)).toBe(INK)
    expect(meanInDisk(half, { x: -10, y: -10 }, 2)).toBeUndefined()
  })
})

describe('findMarker', () => {
  it('finds the centre of a square near where it was expected', () => {
    const image = page(100, 100, square(40, 44, 20))
    const found = findMarker(image, { x: 45, y: 50 }, 20)
    expect(found?.x).toBeCloseTo(49.5, 6)
    expect(found?.y).toBeCloseTo(53.5, 6)
  })

  it('picks the square nearest to the expected spot when there are two', () => {
    const image = page(200, 100, (x, y) => square(40, 40, 16)(x, y) || square(70, 40, 16)(x, y))
    expect(findMarker(image, { x: 72, y: 45 }, 16)?.x).toBeCloseTo(77.5, 6)
  })

  it('finds nothing on blank paper, where the darkest and lightest pixels are the same', () => {
    expect(findMarker(page(60, 60, () => false), { x: 30, y: 30 }, 10)).toBeNull()
  })

  /** A line of the frame or a printed letter is dark, but not a solid square of the expected size. */
  it('finds nothing where the ink is a line or too small a dot', () => {
    const line = page(100, 100, (x, y) => y === 50 && x > 10 && x < 90)
    const dot = page(100, 100, square(48, 48, 3))
    expect(findMarker(line, { x: 50, y: 50 }, 20)).toBeNull()
    expect(findMarker(dot, { x: 50, y: 50 }, 20)).toBeNull()
  })

  it('searches only around the expected spot, so a square farther away is not taken', () => {
    const image = page(300, 100, square(240, 40, 16))
    expect(findMarker(image, { x: 40, y: 48 }, 16)).toBeNull()
  })
})
