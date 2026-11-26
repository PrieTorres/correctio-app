import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/** RFC 6238 defaults, the only values every authenticator app supports. */
export const TOTP_STEP_SECONDS = 30
export const TOTP_DIGITS = 6

/** 160 bits, the size RFC 4226 recommends for an HMAC-SHA1 secret. */
const SECRET_BYTES = 20

/**
 * Steps accepted on each side of the current one, so a phone whose clock is
 * off by up to half a minute still signs in.
 */
export const TOTP_WINDOW_STEPS = 1

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const BITS_PER_BASE32_CHAR = 5
const BITS_PER_BYTE = 8
const ISSUER = 'Correctio'

const SIX_DIGITS = /^\d{6}$/

/** RFC 4648 base32 without padding, the form authenticator apps read. */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let encoded = ''
  for (const byte of bytes) {
    value = (value << BITS_PER_BYTE) | byte
    bits += BITS_PER_BYTE
    while (bits >= BITS_PER_BASE32_CHAR) {
      encoded += BASE32_ALPHABET[(value >>> (bits - BITS_PER_BASE32_CHAR)) & 31]
      bits -= BITS_PER_BASE32_CHAR
    }
    value &= (1 << bits) - 1
  }
  if (bits > 0) encoded += BASE32_ALPHABET[(value << (BITS_PER_BASE32_CHAR - bits)) & 31]
  return encoded
}

/** Inverse of `base32Encode`; throws on a character outside the alphabet. */
export function base32Decode(text: string): Buffer {
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const char of text.toUpperCase().replaceAll('=', '')) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) throw new Error('Not a base32 character')
    value = (value << BITS_PER_BASE32_CHAR) | index
    bits += BITS_PER_BASE32_CHAR
    if (bits >= BITS_PER_BYTE) {
      bytes.push((value >>> (bits - BITS_PER_BYTE)) & 255)
      bits -= BITS_PER_BYTE
    }
    value &= (1 << bits) - 1
  }
  return Buffer.from(bytes)
}

/** A new random secret, in base32. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(SECRET_BYTES))
}

/** The time step a moment belongs to: seconds since the epoch divided into 30 s slots. */
export function totpStepAt(timeMs: number): number {
  return Math.floor(timeMs / 1000 / TOTP_STEP_SECONDS)
}

/** RFC 4226 HOTP with dynamic truncation, which RFC 6238 reuses with the step as the counter. */
function hotp(secret: Buffer, counter: number): string {
  const message = Buffer.alloc(8)
  message.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac('sha1', secret).update(message).digest()
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f
  const binary = digest.readUInt32BE(offset) & 0x7fffffff
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0')
}

/** The code the authenticator app shows for `step`. */
export function totpCodeForStep(base32Secret: string, step: number): string {
  return hotp(base32Decode(base32Secret), step)
}

/**
 * The step whose code is `code` within the window around `timeMs`, or `null`.
 * The caller records the step so the same code is not accepted twice.
 *
 * @param code The six digits the user typed; anything else never matches.
 * @returns The matching time step, which may differ from the current one by the window.
 */
export function matchTotp(base32Secret: string, code: string, timeMs: number): number | null {
  if (!SIX_DIGITS.test(code)) return null
  const secret = base32Decode(base32Secret)
  const typed = Buffer.from(code)
  const current = totpStepAt(timeMs)
  let matched: number | null = null
  for (let step = current - TOTP_WINDOW_STEPS; step <= current + TOTP_WINDOW_STEPS; step++) {
    if (timingSafeEqual(typed, Buffer.from(hotp(secret, step)))) matched = step
  }
  return matched
}

/** The `otpauth://` address an authenticator app reads from the QR Code. */
export function totpUri(base32Secret: string, accountEmail: string): string {
  const params = new URLSearchParams({
    secret: base32Secret,
    issuer: ISSUER,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  })
  return `otpauth://totp/${ISSUER}:${encodeURIComponent(accountEmail)}?${params.toString()}`
}
