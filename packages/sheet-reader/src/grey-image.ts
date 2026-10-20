import type { Point } from './perspective'
import type { PixelImage } from './qr-decoder'

/** One brightness per pixel, from 0 (black) to 255 (white): ink is measured as darkness, and colour only gets in the way. */
export interface GreyImage {
  readonly levels: Float32Array
  readonly width: number
  readonly height: number
}

/** The ITU-R BT.601 weights, the brightness the eye sees, so a blue pen reads as dark as it looks. */
export function toGrey({ data, width, height }: PixelImage): GreyImage {
  const levels = new Float32Array(width * height)
  for (let index = 0; index < levels.length; index += 1) {
    const offset = index * 4
    levels[index] = 0.299 * (data[offset] ?? 0) + 0.587 * (data[offset + 1] ?? 0) + 0.114 * (data[offset + 2] ?? 0)
  }
  return { levels, width, height }
}

/** The brightness at a pixel, or `undefined` outside the photo. */
export function levelAt(image: GreyImage, x: number, y: number): number | undefined {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return undefined
  return image.levels[y * image.width + x]
}

/**
 * The average brightness of the pixels within `radius` of `center` that are on
 * the photo, or `undefined` when none is. Averaging a disk instead of
 * reading one pixel is what makes a mark count by how much ink it has, not by
 * where one stroke happened to cross.
 */
export function meanInDisk(image: GreyImage, center: Point, radius: number): number | undefined {
  let sum = 0
  let count = 0
  const reach = Math.ceil(radius)
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      const level = dx * dx + dy * dy <= radius * radius ? levelAt(image, Math.round(center.x) + dx, Math.round(center.y) + dy) : undefined
      if (level === undefined) continue
      sum += level
      count += 1
    }
  }
  return count === 0 ? undefined : sum / count
}
