import cors from 'cors'
import express, { type Express } from 'express'
import helmet from 'helmet'
import type { Kysely } from 'kysely'
import type { Logger } from 'pino'
import { pinoHttp } from 'pino-http'
import type { Env } from './config/env'
import { refuseWithoutKey, type FieldCipher } from './lib/field-encryption'
import { BODY_LIMIT_BYTES, limitBodySize } from './middlewares/body-limit'
import { createErrorHandler } from './middlewares/error-handler'
import { noStore } from './middlewares/no-store'
import { notFound } from './middlewares/not-found'
import {
  byClientAddress,
  byTeacher,
  createRateLimit,
  createTeacherRateLimit,
  RATE_LIMITS,
  type RateLimitTier,
} from './middlewares/rate-limit'
import { createRequireAuth, rejectAllTokens, type VerifyToken } from './middlewares/require-auth'
import type { Database } from './models/tables'
import { createRouter } from './routes'
import { createHealthService, type HealthCheck } from './services/health-service'

type RateLimitName = 'failedAuth' | 'read' | 'write' | 'expensive'

export interface AppDependencies {
  env: Env
  logger: Logger
  db: Kysely<Database>
  verifyToken?: VerifyToken
  /**
   * Encrypts the student e-mail. The default refuses, like `rejectAllTokens`
   * for tokens, so an app built without a key never stores an address in plain
   * text; `bootstrapApi` always passes a real one.
   */
  fieldCipher?: FieldCipher
  healthChecks?: readonly HealthCheck[]
  /** Overridable, one tier at a time, so tests reach a limit in a few requests instead of hundreds. */
  rateLimits?: Partial<Record<RateLimitName, RateLimitTier>>
  /**
   * Where the routes answer. Locally the API owns its origin and answers at
   * `/`; on Firebase, Hosting forwards `/api/**` to the function with the
   * prefix intact, so the same routes answer under `/api`.
   */
  basePath?: string
}

const DEFAULT_RATE_LIMITS: Readonly<Record<RateLimitName, RateLimitTier>> = {
  failedAuth: RATE_LIMITS.FAILED_AUTH,
  read: RATE_LIMITS.READ,
  write: RATE_LIMITS.WRITE,
  expensive: RATE_LIMITS.EXPENSIVE,
}

/**
 * Builds the Express app without listening, so tests drive it through
 * supertest and `server.ts` is the only place that opens a port.
 *
 * `trust proxy` is set because the API runs behind the host's proxy: without
 * it every request seems to come from the same address, and a per-client rate
 * limit would throttle everyone at once.
 */
export function createApp({
  env,
  logger,
  db,
  verifyToken = rejectAllTokens,
  fieldCipher = refuseWithoutKey,
  healthChecks = [],
  rateLimits = {},
  basePath = '/',
}: AppDependencies): Express {
  const limits = { ...DEFAULT_RATE_LIMITS, ...rateLimits }
  const app = express()

  app.set('trust proxy', env.TRUST_PROXY_HOPS)
  app.use(helmet())
  app.use(noStore)
  app.use(cors({ origin: [...env.CORS_ORIGINS] }))
  app.use(limitBodySize)
  app.use(express.json({ limit: BODY_LIMIT_BYTES }))
  app.use(pinoHttp({ logger }))

  app.use(
    basePath,
    createRouter({
      healthService: createHealthService(healthChecks),
      db,
      fieldCipher,
      failedAuthLimit: createRateLimit(limits.failedAuth, { key: byClientAddress, countOnlyUnauthorized: true }),
      requireAuth: createRequireAuth(verifyToken),
      teacherLimit: createTeacherRateLimit(limits),
      expensiveLimit: createRateLimit(limits.expensive, { key: byTeacher }),
    }),
  )
  app.use(notFound)
  app.use(createErrorHandler(logger))

  return app
}
