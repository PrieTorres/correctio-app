import { answerSheetCodeFromQr } from '@correctio/domain'
import { decodeQrTexts, type PixelImage } from './qr-decoder'

/** What identifying needs from an `AnswerSheet`; the caller gets back its own record. */
export interface SheetWithCode {
  code: string
}

/**
 * Which sheet of this application the photo shows, or `null`: "QR não
 * reconhecido" (RF30), and the teacher picks the sheet by hand.
 *
 * Only the sheets passed in count. A code from another application, or from a
 * PDF regenerated since (RF24), is as unknown as an unreadable one, so a photo
 * can never be graded against a sheet it was not printed for.
 */
export async function identifySheet<Sheet extends SheetWithCode>(
  image: PixelImage,
  sheets: readonly Sheet[],
): Promise<Sheet | null> {
  const byCode = new Map(sheets.map((sheet) => [sheet.code, sheet]))

  for (const text of await decodeQrTexts(image)) {
    const code = answerSheetCodeFromQr(text)
    const sheet = code === null ? undefined : byCode.get(code)
    if (sheet !== undefined) return sheet
  }
  return null
}
