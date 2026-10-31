/** The kinds of photo a sheet may be sent as, told apart by their first bytes. */
export const SHEET_PHOTO_TYPES = Object.freeze({
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  WEBP: 'image/webp',
} as const)

export type SheetPhotoType = (typeof SHEET_PHOTO_TYPES)[keyof typeof SHEET_PHOTO_TYPES]

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean =>
  bytes.length >= offset + signature.length && signature.every((byte, index) => bytes[offset + index] === byte)

const ascii = (text: string): number[] => [...text].map((char) => char.charCodeAt(0))

/**
 * What the file really is, read from its first bytes, never from the name or
 * the `Content-Type` the client sent (`docs/Seguranca_e_LGPD.md`, section 7):
 * both are the sender's say-so. `undefined` for anything else, a HEIC from an
 * iPhone included, since the server cannot decode it; the browser sends the
 * camera's photo as JPEG.
 */
export function sheetPhotoTypeOf(bytes: Uint8Array): SheetPhotoType | undefined {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return SHEET_PHOTO_TYPES.JPEG
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return SHEET_PHOTO_TYPES.PNG
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return SHEET_PHOTO_TYPES.WEBP
  return undefined
}

/** The extension the stored file is named with, so a download keeps a name the phone or computer opens. */
export const EXTENSION_OF: Readonly<Record<SheetPhotoType, string>> = {
  [SHEET_PHOTO_TYPES.JPEG]: 'jpg',
  [SHEET_PHOTO_TYPES.PNG]: 'png',
  [SHEET_PHOTO_TYPES.WEBP]: 'webp',
}
