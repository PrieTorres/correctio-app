import { answerSheetCodeFromQr } from '@correctio/domain'
import { decodeQrCodes, type DecodedQr, type PixelImage } from './qr-decoder'

/** What identifying needs from an `AnswerSheet`; the caller gets back its own record. */
export interface SheetWithCode {
  code: string
}

/** A sheet of this application found on the photo, with the QR Code that named it and where that code is. */
export interface IdentifiedSheet<Sheet> {
  sheet: Sheet
  qr: DecodedQr
}

/**
 * The first decoded QR Code that names one of `sheets`, or `null`.
 *
 * Only the sheets passed in count. A code from another application, or from a
 * PDF regenerated since (RF24), is as unknown as an unreadable one, so a photo
 * can never be graded against a sheet it was not printed for.
 */
export function matchSheet<Sheet extends SheetWithCode>(codes: readonly DecodedQr[], sheets: readonly Sheet[]): IdentifiedSheet<Sheet> | null {
  const byCode = new Map(sheets.map((sheet) => [sheet.code, sheet]))
  for (const qr of codes) {
    const code = answerSheetCodeFromQr(qr.text)
    const sheet = code === null ? undefined : byCode.get(code)
    if (sheet !== undefined) return { sheet, qr }
  }
  return null
}

/**
 * Which sheet of this application the photo shows, or `null` when its QR
 * Code is not recognized (RF30), and the teacher picks the sheet by hand.
 */
export async function identifySheet<Sheet extends SheetWithCode>(image: PixelImage, sheets: readonly Sheet[]): Promise<Sheet | null> {
  return matchSheet(await decodeQrCodes(image), sheets)?.sheet ?? null
}
