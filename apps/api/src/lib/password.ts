import { randomBytes } from 'node:crypto'
import { hash, verify } from '@node-rs/argon2'

/**
 * argon2id, the library's default variant, with the OWASP minimum (19 MiB,
 * 2 passes, 1 lane): slow enough that a leaked table costs an attacker real
 * time per guess, fast enough for one sign-in on the API's single instance.
 * Never reversible: not even the system can read a password back
 * (`docs/Seguranca_e_LGPD.md`, section 7).
 */
const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 }

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS)
}

/** A hash that is not argon2 (an anonymized account, a corrupted row) is a wrong password, never an error. */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password)
  } catch {
    return false
  }
}

/**
 * For an account that has no password of its own: one created through Google,
 * or one anonymized. The column stays filled, as the Spec requires, with the
 * hash of a random secret nobody ever saw, so no password matches it; the
 * owner of a Google account can still set one through the password reset.
 */
export function unusablePasswordHash(): Promise<string> {
  return hashPassword(randomBytes(32).toString('base64url'))
}
