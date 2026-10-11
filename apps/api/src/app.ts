import cors from 'cors'
import express, { type Express } from 'express'
import helmet from 'helmet'
import type { Logger } from 'pino'
import { pinoHttp } from 'pino-http'
import type { Env } from './config/env'
import { createErrorHandler } from './middlewares/error-handler'
import { noStore } from './middlewares/no-store'
import { notFound } from './middlewares/not-found'
import {
  byClientAddress,
  createRateLimit,
  createTeacherRateLimit,
  RATE_LIMITS,
  type RateLimitTier,
} from './middlewares/rate-limit'
import { createRequireAuth, rejectAllTokens, type VerifyToken } from './middlewares/require-auth'
import { createRouter } from './routes'
import { createHealthService, type HealthCheck } from './services/health-service'

export interface AppDependencies {
  env: Env
  logger: Logger
  verifyToken?: VerifyToken
  healthChecks?: readonly HealthCheck[]
  /** Overridable so tests reach a limit in a few requests instead of hundreds. */
  rateLimits?: { failedAuth: RateLimitTier; read: RateLimitTier; write: RateLimitTier }
}

const DEFAULT_RATE_LIMITS = { failedAuth: RATE_LIMITS.FAILED_AUTH, read: RATE_LIMITS.READ, write: RATE_LIMITS.WRITE }

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
  verifyToken = rejectAllTokens,
  healthChecks = [],
  rateLimits = DEFAULT_RATE_LIMITS,
}: AppDependencies): Express {
  const app = express()

  app.set('trust proxy', env.TRUST_PROXY_HOPS)
  app.use(helmet())
  app.use(noStore)
  app.use(cors({ origin: [...env.CORS_ORIGINS] }))
  app.use(express.json({ limit: '100kb' }))
  app.use(pinoHttp({ logger }))

  app.use(
    createRouter({
      healthService: createHealthService(healthChecks),
      failedAuthLimit: createRateLimit(rateLimits.failedAuth, { key: byClientAddress, countOnlyUnauthorized: true }),
      requireAuth: createRequireAuth(verifyToken),
      teacherLimit: createTeacherRateLimit(rateLimits),
    }),
  )
  app.use(notFound)
  app.use(createErrorHandler(logger))

  return app
}
