export function createId(): string {
  return crypto.randomUUID()
}

/** Base32 alphabet without 0/1/O/I, which are ambiguous on printed paper. */
const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const CODE_LENGTH = 26

/**
 * Opaque lookup code for a printed answer sheet.
 *
 * 26 base32 symbols carry 130 bits of entropy. It must never be sequential or
 * derived from another id: the public lookup asks for no other credential, so
 * this code is the only thing standing between a scraper and every grade.
 */
export function createAnswerSheetCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  return Array.from(bytes, (byte) => CODE_ALPHABET.charAt(byte % 32)).join('')
}

/**
 * Invite code for a class, as required by the specification.
 *
 * Short and human-readable because a teacher may dictate it; regenerable, so
 * it is not treated as a secret.
 */
export function createInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (byte) => CODE_ALPHABET.charAt(byte % 32)).join('')
}
