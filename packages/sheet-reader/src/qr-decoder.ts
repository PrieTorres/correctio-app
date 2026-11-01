import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import type { Quad } from './perspective'

/**
 * Pixels in RGBA order, four bytes each: what a canvas gives in the browser and
 * what the server decodes a photo into. Nothing in the reader depends on where
 * they came from, which is what lets it run in both places (ADR-006).
 */
export interface PixelImage {
  readonly data: Uint8ClampedArray<ArrayBuffer>
  readonly width: number
  readonly height: number
}

/**
 * Where the decoder's WebAssembly comes from. Left alone, the library downloads
 * it from a public CDN; the app always serves its own copy instead, as the bytes
 * in Node and as the URL of the bundled file in the browser.
 */
export type QrDecoderBinary = { wasmBinary: ArrayBuffer } | { wasmUrl: string }

/** Called once where the app starts, before the first reading. */
export function useQrDecoderBinary(binary: QrDecoderBinary): void {
  const overrides = 'wasmBinary' in binary ? { wasmBinary: binary.wasmBinary } : { locateFile: () => binary.wasmUrl }
  prepareZXingModule({ overrides })
}

/** At most this many codes per photo: a sheet has one, and a table full of sheets should not be read in a single shot. */
const MAX_CODES = 4

/** One QR Code found on the photo. */
export interface DecodedQr {
  text: string
  /**
   * The outer corners of the symbol on the photo, named by the symbol itself:
   * `topLeft` is its top-left corner however the sheet was turned. Since the
   * card prints the QR Code at a fixed place, this is also where the card is
   * and which way up it lies.
   */
  corners: Quad
}

/**
 * Every QR Code in the image. Tries hard, because a phone photo is tilted,
 * unevenly lit and noisy, which is what the decoder was chosen for (ADR-006).
 */
export async function decodeQrCodes(image: PixelImage): Promise<DecodedQr[]> {
  const imageData = { data: image.data, width: image.width, height: image.height, colorSpace: 'srgb' as const }
  const results = await readBarcodes(imageData, { formats: ['QRCode'], tryHarder: true, maxNumberOfSymbols: MAX_CODES })
  return results.filter((result) => result.isValid).map(({ text, position }) => ({ text, corners: position }))
}
