import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import QRCode from 'qrcode'
import type { PixelImage, QrDecoderBinary } from '../qr-decoder'

/** The decoder's own WebAssembly from `node_modules`, as the server loads it, so no test reaches the CDN. */
export function localDecoderBinary(): QrDecoderBinary {
  const file = readFileSync(createRequire(import.meta.url).resolve('zxing-wasm/reader/zxing_reader.wasm'))
  return { wasmBinary: file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) }
}

/** How the camera saw the sheet. */
export interface Shot {
  /** Degrees the sheet is turned on the table. */
  angle?: number
  /** How much the far edge shrinks when the phone is held at a slant, from 0 (straight above). */
  tilt?: number
  /** Standard deviation of the sensor noise, in grey levels. */
  noise?: number
  /** How much darker the right side is, from 0 to 1, as under a lamp to one side. */
  shade?: number
  /** Passes of a 3 by 3 box blur, as when the phone did not focus. */
  blur?: number
  /** Pixels per QR module once on the photo. */
  modulePx?: number
}

/** Smaller than any phone photo (a 12 MP camera gives about 3000 by 4000), so a pass here is a conservative one. */
const WIDTH = 900
const HEIGHT = 1200
const PAPER = 235
const INK = 30
const QUIET_MODULES = 4

/** A fixed sequence, so a failing test fails the same way every time. */
function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31
    return state / 2 ** 31
  }
}

function gaussian(random: () => number): number {
  const u = Math.max(random(), Number.EPSILON)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random())
}

/** Grey level of the paper at a photo pixel, tracing it back through the slant and the turn to the printed QR. */
function paperAt(x: number, y: number, matrix: QRCode.BitMatrix, shot: Required<Shot>): number {
  const size = (matrix.size + 2 * QUIET_MODULES) * shot.modulePx
  const centerX = WIDTH * 0.7
  const centerY = HEIGHT * 0.2
  const radians = (shot.angle * Math.PI) / 180
  const dx = (x - centerX) / (1 + shot.tilt * ((y - centerY) / HEIGHT))
  const dy = y - centerY
  const u = Math.cos(-radians) * dx - Math.sin(-radians) * dy + size / 2
  const v = Math.sin(-radians) * dx + Math.cos(-radians) * dy + size / 2
  const column = Math.floor(u / shot.modulePx) - QUIET_MODULES
  const row = Math.floor(v / shot.modulePx) - QUIET_MODULES
  const inside = column >= 0 && row >= 0 && column < matrix.size && row < matrix.size
  return inside && matrix.get(row, column) ? INK : PAPER
}

function boxBlur(grey: Float32Array): Float32Array {
  const out: Float32Array = new Float32Array(grey)
  for (let y = 1; y < HEIGHT - 1; y += 1) {
    for (let x = 1; x < WIDTH - 1; x += 1) {
      let sum = 0
      for (const offset of [-WIDTH - 1, -WIDTH, -WIDTH + 1, -1, 0, 1, WIDTH - 1, WIDTH, WIDTH + 1]) sum += grey[y * WIDTH + x + offset] ?? 0
      out[y * WIDTH + x] = sum / 9
    }
  }
  return out
}

function toPixels(grey: Float32Array): PixelImage {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4)
  grey.forEach((level, index) => {
    data.fill(level, index * 4, index * 4 + 3)
    data[index * 4 + 3] = 255
  })
  return { data, width: WIDTH, height: HEIGHT }
}

/** A phone photo of a sheet whose QR Code holds `text`, or of blank paper when `text` is null. */
export function photographSheet(text: string | null, shot: Shot = {}, seed = 7): PixelImage {
  const settings: Required<Shot> = { angle: 0, tilt: 0, noise: 0, shade: 0, blur: 0, modulePx: 6, ...shot }
  const matrix = text === null ? null : QRCode.create(text, { errorCorrectionLevel: 'M' }).modules
  const random = seededRandom(seed)
  let grey: Float32Array = new Float32Array(WIDTH * HEIGHT)
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const level = matrix === null ? PAPER : paperAt(x, y, matrix, settings)
      grey[y * WIDTH + x] = level * (1 - settings.shade * (x / WIDTH)) + settings.noise * gaussian(random)
    }
  }
  for (let pass = 0; pass < settings.blur; pass += 1) grey = boxBlur(grey)
  return toPixels(grey)
}
