import { ANSWER_SHEET_CODE } from '@correctio/domain'

export function createId(): string {
  return crypto.randomUUID()
}

const { ALPHABET: CODE_ALPHABET } = ANSWER_SHEET_CODE

/**
 * Invite code for a class, as required by the specification.
 *
 * Short and human-readable because a teacher may dictate it; regenerable, so
 * it is not treated as a secret. The code of an answer sheet, which is the
 * secret, is made by `createAnswerSheetCode` in `@correctio/domain`.
 */
export function createInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (byte) => CODE_ALPHABET.charAt(byte % 32)).join('')
}
