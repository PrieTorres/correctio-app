import { createHash } from 'node:crypto'
import type { Logger } from 'pino'

/** Answers whether a password appears in known data breaches. */
export interface PasswordBreachChecker {
  isBreached: (password: string) => Promise<boolean>
}

const PWNED_RANGE_URL = 'https://api.pwnedpasswords.com/range'
const PREFIX_LENGTH = 5

/**
 * Short, so a slow third party delays sign-up by two seconds at most: the
 * check protects the user and is never worth locking them out.
 */
export const PWNED_TIMEOUT_MS = 2_000

/** Accepts every password: the checker for environments with the check switched off. */
export const acceptAnyPassword: PasswordBreachChecker = { isBreached: () => Promise.resolve(false) }

export interface PwnedCheckerOptions {
  logger: Logger
  fetchFn?: typeof fetch
  timeoutMs?: number
  baseUrl?: string
}

/**
 * Have I Been Pwned "Pwned Passwords" with k-anonymity: only the first five
 * characters of the SHA-1 leave the server, and the match is made here against
 * the list of suffixes that comes back. `Add-Padding` makes the response size
 * independent of the prefix.
 *
 * Fails open: a timeout, a network error or an unexpected status accepts the
 * password and logs a warning with the reason only, never the password or its
 * hash, so an outage of the third party never blocks an account.
 */
export function createPwnedPasswordChecker({
  logger,
  fetchFn = (input, init) => fetch(input, init),
  timeoutMs = PWNED_TIMEOUT_MS,
  baseUrl = PWNED_RANGE_URL,
}: PwnedCheckerOptions): PasswordBreachChecker {
  const skipped = (reason: string) => {
    logger.warn({ reason }, 'Breached-password check skipped: the password was accepted')
    return false
  }

  return {
    async isBreached(password) {
      const hash = createHash('sha1').update(password).digest('hex').toUpperCase()
      const prefix = hash.slice(0, PREFIX_LENGTH)
      const suffix = hash.slice(PREFIX_LENGTH)

      let body: string
      try {
        const response = await fetchFn(`${baseUrl}/${prefix}`, {
          headers: { 'Add-Padding': 'true' },
          signal: AbortSignal.timeout(timeoutMs),
        })
        if (!response.ok) return skipped(`status ${response.status}`)
        body = await response.text()
      } catch (error) {
        return skipped(error instanceof Error ? error.name : 'unknown')
      }

      return body.split('\n').some((line) => {
        const [candidate, count] = line.trim().split(':')
        return candidate === suffix && Number(count) > 0
      })
    },
  }
}
