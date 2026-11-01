import type { SheetImageUpload } from '@/lib/schemas'
import type { ExamVersionLayout } from '@/types/domain'

/** The sheets of one application and the layout of each version, which is what reading a photo needs. */
export interface ReadingContext {
  sheets: readonly { id: string; code: string; examVersionId: string }[]
  layouts: Readonly<Record<string, ExamVersionLayout>>
}

/** A reading without the id of the photo, which whoever stores it adds. */
export type PhotoReading = DistributiveOmit<SheetImageUpload, 'imageId'>

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** The same ceiling the API applies, for the same reason: past it, decoding costs time and reads nothing more. */
const MAX_SIDE = 2400

/**
 * The photo as RGBA pixels, upright and no larger than needed. The browser
 * applies the orientation the phone wrote (`from-image`), as `sharp` does on
 * the server.
 */
async function toPixels(photo: Blob) {
  const bitmap = await createImageBitmap(photo, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('The browser gave no canvas to read the photo on')
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return context.getImageData(0, 0, width, height)
}

/**
 * Reads a photo in the browser, for the demo without an API (ADR-006, ADR-007):
 * the same reader as the server's, loaded only when a photo is read, with the
 * decoder's WebAssembly bundled by Vite instead of fetched from a CDN.
 */
export async function readPhotoInBrowser(photo: Blob, { sheets, layouts }: ReadingContext): Promise<PhotoReading> {
  const [{ readSheet, useQrDecoderBinary: setQrDecoderBinary }, { default: wasmUrl }] = await Promise.all([
    import('@correctio/sheet-reader'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ])
  setQrDecoderBinary({ wasmUrl })

  const pixels = await toPixels(photo).catch(() => null)
  if (pixels === null) return { status: 'QR_NOT_RECOGNIZED' }

  const reading = await readSheet(pixels, { sheets, layoutOf: (sheet) => layouts[sheet.examVersionId] })
  if (reading.status === 'QR_NOT_RECOGNIZED') return reading
  if (reading.status === 'READ_FAILED') return { status: reading.status, answerSheetId: reading.sheet.id }
  return { status: reading.status, answerSheetId: reading.sheet.id, answers: reading.answers }
}
