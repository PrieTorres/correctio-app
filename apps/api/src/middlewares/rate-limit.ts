import type { Request, RequestHandler, Response } from 'express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
import { slowDown } from 'express-slow-down'
import { API_ERROR_CODE, ApiError } from '../lib/api-error'
import { currentTeacherId } from './require-auth'

export interface RateLimitTier {
  windowMs: number
  limit: number
}

const MINUTE = 60_000

/**
 * The tiers of `docs/Seguranca_e_LGPD.md`, section 4. A single ceiling for
 * every route would either block a bulk import or let someone burn PDF
 * generations, so each kind of route has its own.
 *
 * `FAILED_AUTH` is the barrier against guessing tokens: it counts only the
 * requests refused with 401, per address.
 */
export const RATE_LIMITS = Object.freeze({
  PUBLIC: { windowMs: MINUTE, limit: 30 },
  SIGN_IN: { windowMs: 15 * MINUTE, limit: 5 },
  FAILED_AUTH: { windowMs: MINUTE, limit: 30 },
  READ: { windowMs: MINUTE, limit: 300 },
  WRITE: { windowMs: MINUTE, limit: 60 },
  EXPENSIVE: { windowMs: 60 * MINUTE, limit: 10 },
} as const satisfies Record<string, RateLimitTier>)

type RateLimitKey = (req: Request, res: Response) => string

/**
 * The client address, only where there is no user yet: public routes and
 * sign-in. Six hundred teachers leave the campus through the same address, so
 * limiting signed-in traffic by address would let one of them lock out all.
 */
export const byClientAddress: RateLimitKey = (req) => ipKeyGenerator(req.ip ?? '')

function typedEmail(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('email' in body) || typeof body.email !== 'string') return ''
  return body.email.trim().toLowerCase()
}

/**
 * Address and typed e-mail, for sign-in, sign-up and the reset request
 * (`docs/Seguranca_e_LGPD.md`, section 4). Someone guessing one account's
 * password is stopped, and a teacher on the campus network is not locked out
 * because a colleague behind the same address mistyped theirs.
 */
export const byClientAddressAndEmail: RateLimitKey = (req) => `${ipKeyGenerator(req.ip ?? '')}|${typedEmail(req.body)}`

/** The signed-in teacher, for everything behind `requireAuth`. */
export const byTeacher: RateLimitKey = (_req, res) => currentTeacherId(res)

/** Which responses spend a limiter's budget. */
export const COUNTED_RESPONSES = Object.freeze({
  ALL: 'ALL',
  /** Any 4xx or 5xx: a correct sign-in never brings the block closer. */
  FAILURES: 'FAILURES',
  /** Only 401, so a signed-in teacher's 404 or 400 never spends the address's budget. */
  UNAUTHORIZED: 'UNAUTHORIZED',
} as const)

export type CountedResponses = (typeof COUNTED_RESPONSES)[keyof typeof COUNTED_RESPONSES]

const SPARED_RESPONSE: Readonly<Record<CountedResponses, (res: Response) => boolean>> = {
  [COUNTED_RESPONSES.ALL]: () => false,
  [COUNTED_RESPONSES.FAILURES]: (res) => res.statusCode < 400,
  [COUNTED_RESPONSES.UNAUTHORIZED]: (res) => res.statusCode !== 401,
}

const TOO_MANY_REQUESTS = 'Muitas requisições em pouco tempo. Tente de novo em instantes.'

interface RateLimitOptions {
  key: RateLimitKey
  counts?: CountedResponses
  /** What the screen shows when the limit is reached. */
  message?: string
}

function countingOptions(counts: CountedResponses) {
  return {
    skipSuccessfulRequests: counts !== COUNTED_RESPONSES.ALL,
    requestWasSuccessful: (_req: Request, res: Response) => SPARED_RESPONSE[counts](res),
  }
}

/**
 * A limiter that answers in the API's own error shape. `Retry-After` carries
 * the whole window, the longest the client could have to wait.
 *
 * The counters live in memory, which is right for a single instance. With more
 * than one, each instance would count apart and multiply the limit, so the
 * store has to move to Redis first (#39).
 */
export function createRateLimit(
  tier: RateLimitTier,
  { key, counts = COUNTED_RESPONSES.ALL, message = TOO_MANY_REQUESTS }: RateLimitOptions,
): RequestHandler {
  return rateLimit({
    windowMs: tier.windowMs,
    limit: tier.limit,
    keyGenerator: key,
    ...countingOptions(counts),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(
        new ApiError(API_ERROR_CODE.TOO_MANY_REQUESTS, message, {
          retryAfterSeconds: Math.ceil(tier.windowMs / 1000),
        }),
      )
    },
  })
}

/**
 * The "espera progressiva" of the sign-in routes: the first two attempts answer
 * at once, and each one after waits half a second more, up to two seconds. A
 * person retyping a password barely notices; a script trying passwords loses
 * most of its speed long before the block.
 */
export const SIGN_IN_DELAY = Object.freeze({ FREE_ATTEMPTS: 2, STEP_MS: 500, MAX_MS: 2_000 })

/** How long the `attempt`-th counted request of a window waits. */
export function signInDelayMs(attempt: number, stepMs: number = SIGN_IN_DELAY.STEP_MS): number {
  return Math.min(Math.max(0, attempt - SIGN_IN_DELAY.FREE_ATTEMPTS) * stepMs, SIGN_IN_DELAY.MAX_MS)
}

interface SignInLimitOptions extends RateLimitOptions {
  /** Overridable so tests do not wait for real. */
  delayStepMs?: number
}

/**
 * The limit and the progressive delay together, counting the same responses.
 * The limit comes first, so a blocked request is refused at once instead of
 * waiting to be refused.
 */
export function createSignInLimit(
  tier: RateLimitTier,
  { key, counts = COUNTED_RESPONSES.ALL, message, delayStepMs = SIGN_IN_DELAY.STEP_MS }: SignInLimitOptions,
): RequestHandler[] {
  const delay = slowDown({
    windowMs: tier.windowMs,
    delayAfter: SIGN_IN_DELAY.FREE_ATTEMPTS,
    delayMs: (used) => signInDelayMs(used, delayStepMs),
    keyGenerator: key,
    ...countingOptions(counts),
  })
  return [createRateLimit(tier, { key, counts, message }), delay]
}

const READ_METHODS = new Set(['GET', 'HEAD'])

export interface TeacherLimits {
  read: RateLimitTier
  write: RateLimitTier
}

/** Reads and writes in separate budgets, per teacher, so browsing never runs out because of saving and vice versa. */
export function createTeacherRateLimit(
  limits: TeacherLimits = { read: RATE_LIMITS.READ, write: RATE_LIMITS.WRITE },
): RequestHandler {
  const read = createRateLimit(limits.read, { key: byTeacher })
  const write = createRateLimit(limits.write, { key: byTeacher })
  return (req, res, next) => (READ_METHODS.has(req.method) ? read : write)(req, res, next)
}

export interface AuthLimits {
  register: RequestHandler[]
  signIn: RequestHandler[]
  forgotPassword: RequestHandler[]
  resetPassword: RequestHandler[]
}

/**
 * The `SIGN_IN` tier on each route that takes a password or an e-mail, each
 * with its own count. Sign-in counts only failures, so a teacher who gets it
 * right never moves closer to the block; sign-up and the reset request count
 * every attempt, since a repeat of either is never needed. The reset itself
 * carries a code instead of an e-mail, so it counts per address.
 */
export function createAuthLimits(tier: RateLimitTier, delayStepMs?: number): AuthLimits {
  const message = `Muitas tentativas seguidas. Aguarde ${Math.ceil(tier.windowMs / 60_000)} minutos e tente de novo.`
  const limit = (counts: CountedResponses, key: RateLimitKey = byClientAddressAndEmail) =>
    createSignInLimit(tier, { key, counts, message, delayStepMs })
  return {
    register: limit(COUNTED_RESPONSES.ALL),
    signIn: limit(COUNTED_RESPONSES.FAILURES),
    forgotPassword: limit(COUNTED_RESPONSES.ALL),
    resetPassword: limit(COUNTED_RESPONSES.FAILURES, byClientAddress),
  }
}
