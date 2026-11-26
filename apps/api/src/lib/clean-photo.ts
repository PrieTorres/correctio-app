import sharp, { type Sharp } from 'sharp'
import { SHEET_PHOTO_TYPES, type SheetPhotoType } from './image-type'

/** High enough that the marks and the handwriting the teacher reviews stay as the phone took them. */
const QUALITY = 90

const ENCODE: Readonly<Record<SheetPhotoType, (image: Sharp) => Sharp>> = {
  [SHEET_PHOTO_TYPES.JPEG]: (image) => image.jpeg({ quality: QUALITY }),
  [SHEET_PHOTO_TYPES.PNG]: (image) => image.png(),
  [SHEET_PHOTO_TYPES.WEBP]: (image) => image.webp({ quality: QUALITY }),
}

/**
 * The photo written again from its pixels, in the format it came in, turned
 * upright by the orientation the phone recorded. `sharp` copies no metadata
 * unless asked, so the GPS position, the date and the phone model a camera
 * writes in the EXIF are gone (RNF16), and so is anything else hidden in the
 * file.
 */
function reencode(photo: Buffer, type: SheetPhotoType): Promise<Buffer> {
  return ENCODE[type](sharp(photo).rotate()).toBuffer()
}

/** The photo without its metadata, or `null` when it does not decode as the image its first bytes claim. */
export type PhotoCleaner = (photo: Buffer, type: SheetPhotoType) => Promise<Buffer | null>

/**
 * Cleans one photo at a time, in the order they arrive. Decoding a 12 MP phone
 * photo takes 90 to 140 MB, so photos sent together, each decoded at once,
 * would add up past the API's memory.
 */
export function createPhotoCleaner(encode: (photo: Buffer, type: SheetPhotoType) => Promise<Buffer> = reencode): PhotoCleaner {
  let previous: Promise<unknown> = Promise.resolve()
  return (photo, type) => {
    const cleaned = previous.then(() => encode(photo, type)).catch(() => null)
    previous = cleaned
    return cleaned
  }
}
