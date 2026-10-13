import type { Request, RequestHandler, Response } from 'express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
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

/** The signed-in teacher, for everything behind `requireAuth`. */
export const byTeacher: RateLimitKey = (_req, res) => currentTeacherId(res)

interface RateLimitOptions {
  key: RateLimitKey
  /** Counts only 401 responses, so a signed-in teacher's 404 or 400 never spends the address's budget. */
  countOnlyUnauthorized?: boolean
}

/**
 * A limiter that answers in the API's own error shape. `Retry-After` carries
 * the whole window, the longest the client could have to wait.
 *
 * The counters live in memory, which is right for a single instance. With more
 * than one, each instance would count apart and multiply the limit, so the
 * store has to move to Redis first (#39).
 */
export function createRateLimit(tier: RateLimitTier, { key, countOnlyUnauthorized = false }: RateLimitOptions): RequestHandler {
  return rateLimit({
    windowMs: tier.windowMs,
    limit: tier.limit,
    keyGenerator: key,
    skipSuccessfulRequests: countOnlyUnauthorized,
    requestWasSuccessful: (_req, res) => res.statusCode !== 401,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(
        new ApiError(API_ERROR_CODE.TOO_MANY_REQUESTS, 'Muitas requisições em pouco tempo. Tente de novo em instantes.', {
          retryAfterSeconds: Math.ceil(tier.windowMs / 1000),
        }),
      )
    },
  })
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
