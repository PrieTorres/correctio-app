/**
 * The code printed on each answer sheet: 26 symbols of base32 without 0, 1, 8
 * and 9, which read ambiguously on paper. 130 bits of entropy, because the
 * public lookup asks for nothing else (`docs/Seguranca_e_LGPD.md`, section 3).
 *
 * Shared by whoever creates the code (the web app today, the API with #46) and
 * whoever reads it back from a photo (`@correctio/sheet-reader`, #78), so the
 * two can never disagree on what a valid code looks like.
 */
export const ANSWER_SHEET_CODE = Object.freeze({
  ALPHABET: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
  LENGTH: 26,
} as const)

const CODE_PATTERN = new RegExp(`^[${ANSWER_SHEET_CODE.ALPHABET}]{${ANSWER_SHEET_CODE.LENGTH}}$`)

export function isAnswerSheetCode(value: string): boolean {
  return CODE_PATTERN.test(value)
}

/**
 * The sheet code inside what a QR Code holds, or `null` when it holds anything
 * else. Accepts the bare code and the public lookup address, whose last path
 * segment is the code (`/r/:code`), on any domain: a sheet printed before a
 * move of host still reads.
 */
export function answerSheetCodeFromQr(text: string): string | null {
  const trimmed = text.trim()
  if (isAnswerSheetCode(trimmed)) return trimmed

  let path: string
  try {
    path = new URL(trimmed, 'https://qr.invalid').pathname
  } catch {
    return null
  }
  const last = path.split('/').findLast((segment) => segment !== '') ?? ''
  return isAnswerSheetCode(last) ? last : null
}
