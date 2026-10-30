import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { SHEET_READING, type ExamVersionLayout } from '@correctio/domain'
import { readSheet, useQrDecoderBinary, type PixelImage, type ReadAnswer } from '@correctio/sheet-reader'
import sharp from 'sharp'

/** A printed sheet, as much of it as the reading needs to recognize the QR Code and find the marks. */
export interface ReadableSheet {
  id: string
  code: string
  examVersionId: string
}

/** The sheets of one application and the layout each of its versions printed, which turns a row and a letter into an alternative. */
export interface ReadingContext {
  sheets: readonly ReadableSheet[]
  layouts: Readonly<Record<string, ExamVersionLayout>>
}

/** How reading one photo ended, with the sheet named whenever its QR Code was read. */
export type PhotoReading =
  | { status: typeof SHEET_READING.READ; answerSheetId: string; answers: ReadAnswer[] }
  | { status: typeof SHEET_READING.READ_FAILED; answerSheetId: string }
  | { status: typeof SHEET_READING.QR_NOT_RECOGNIZED }

/**
 * Phones take 12 to 48 megapixels, far more than the card needs, and decoding
 * the full frame is most of the time a reading takes. The side kept still
 * gives the bubbles several pixels each.
 */
const MAX_SIDE = 2400

let decoderReady = false

/**
 * The decoder's WebAssembly is read from the installed package, never fetched
 * from the CDN the library would otherwise use (ADR-006). Once per thread.
 */
function prepareDecoder(): void {
  if (decoderReady) return
  const file = readFileSync(createRequire(import.meta.url).resolve('zxing-wasm/reader/zxing_reader.wasm'))
  useQrDecoderBinary({ wasmBinary: file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) })
  decoderReady = true
}

/**
 * The photo as RGBA pixels, upright: `rotate()` applies the orientation the
 * phone wrote in the EXIF, which is how a portrait photo is stored sideways.
 */
async function toPixels(photo: Uint8Array): Promise<PixelImage> {
  const { data, info } = await sharp(photo)
    .rotate()
    .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data: new Uint8ClampedArray(data), width: info.width, height: info.height }
}

/**
 * Reads the photo of a sheet with the same reader the browser uses (ADR-006):
 * which sheet of the application it is, from the QR Code, and the alternative
 * marked in each objective question. A photo `sharp` cannot decode is a photo
 * with no QR Code to recognize.
 */
export async function readPhoto(photo: Uint8Array, { sheets, layouts }: ReadingContext): Promise<PhotoReading> {
  prepareDecoder()
  const pixels = await toPixels(photo).catch(() => null)
  if (pixels === null) return { status: SHEET_READING.QR_NOT_RECOGNIZED }

  const reading = await readSheet(pixels, { sheets, layoutOf: (sheet) => layouts[sheet.examVersionId] })
  if (reading.status === SHEET_READING.QR_NOT_RECOGNIZED) return reading
  if (reading.status === SHEET_READING.READ_FAILED) return { status: reading.status, answerSheetId: reading.sheet.id }
  return { status: reading.status, answerSheetId: reading.sheet.id, answers: reading.answers }
}
