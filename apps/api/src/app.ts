import cors from 'cors'
import express, { type Express } from 'express'
import helmet from 'helmet'
import type { Kysely } from 'kysely'
import type { Logger } from 'pino'
import { pinoHttp } from 'pino-http'
import type { Env } from './config/env'
import { createAuthController } from './controllers/auth-controller'
import { refuseWithoutKey, type FieldCipher } from './lib/field-encryption'
import { unavailableFileStorage, type FileStorage } from './lib/file-storage'
import { createSessionCookie } from './lib/session-cookie'
import { BODY_LIMIT_BYTES, limitBodySize } from './middlewares/body-limit'
import { createErrorHandler } from './middlewares/error-handler'
import { noStore } from './middlewares/no-store'
import { notFound } from './middlewares/not-found'
import {
  byClientAddress,
  byTeacher,
  COUNTED_RESPONSES,
  createAuthLimits,
  createRateLimit,
  createTeacherRateLimit,
  RATE_LIMITS,
  type RateLimitTier,
} from './middlewares/rate-limit'
import { createRequireAuth, rejectAllTokens, type VerifyToken } from './middlewares/require-auth'
import type { Database } from './models/tables'
import { createRouter } from './routes'
import type { AuthService } from './services/auth-service'
import type { GoogleSignInService } from './services/google-sign-in-service'
import { createHealthService, type HealthCheck } from './services/health-service'
import { REFRESH_TOKEN_TTL_MS } from './services/session-issuer'

/** What `composeAuth` builds; absent, the API has no sign-in routes and refuses every token. */
export interface AuthComponents {
  service: AuthService
  google: GoogleSignInService
  verifyToken: VerifyToken
}

interface RateLimits {
  failedAuth: RateLimitTier
  read: RateLimitTier
  write: RateLimitTier
  signIn: RateLimitTier
  expensive: RateLimitTier
}

export interface AppDependencies {
  env: Env
  logger: Logger
  db: Kysely<Database>
  auth?: AuthComponents
  /** Overrides the token check of `auth`, for tests that need only the gate. */
  verifyToken?: VerifyToken
  /**
   * Encrypts the student e-mail. The default refuses, like `rejectAllTokens`
   * for tokens, so an app built without a key never stores an address in plain
   * text; `bootstrapApi` always passes a real one.
   */
  fieldCipher?: FieldCipher
  /**
   * Where the PDFs are kept. The default refuses every call, like
   * `refuseWithoutKey` for the e-mail, so an app built without storage fails
   * loudly instead of losing a file; `bootstrapApi` always passes a real one.
   */
  fileStorage?: FileStorage
  healthChecks?: readonly HealthCheck[]
  /** Overridable so tests reach a limit in a few requests instead of hundreds. */
  rateLimits?: Partial<RateLimits>
  /** Overridable so tests do not wait through the progressive delay of sign-in. */
  signInDelayStepMs?: number
  /**
   * Where the routes answer. Locally the API owns its origin and answers at
   * `/`; on Firebase, Hosting forwards `/api/**` to the function with the
   * prefix intact, so the same routes answer under `/api`.
   */
  basePath?: string
}

const DEFAULT_RATE_LIMITS: RateLimits = {
  failedAuth: RATE_LIMITS.FAILED_AUTH,
  read: RATE_LIMITS.READ,
  write: RATE_LIMITS.WRITE,
  signIn: RATE_LIMITS.SIGN_IN,
  expensive: RATE_LIMITS.EXPENSIVE,
}

/** The cookie is `Secure` wherever the web app is served over HTTPS, which is every published site. */
function authRoutesFor(auth: AuthComponents, env: Env, limits: RateLimits, delayStepMs: number | undefined) {
  const cookie = createSessionCookie({ secure: env.PUBLIC_APP_URL.startsWith('https:'), maxAgeMs: REFRESH_TOKEN_TTL_MS })
  return {
    controller: createAuthController({ auth: auth.service, google: auth.google, cookie }),
    limits: createAuthLimits(limits.signIn, delayStepMs),
  }
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
  auth,
  verifyToken = auth?.verifyToken ?? rejectAllTokens,
  fieldCipher = refuseWithoutKey,
  fileStorage = unavailableFileStorage,
  healthChecks = [],
  rateLimits,
  signInDelayStepMs,
  basePath = '/',
}: AppDependencies): Express {
  const app = express()
  const limits = { ...DEFAULT_RATE_LIMITS, ...rateLimits }

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
      fileStorage,
      failedAuthLimit: createRateLimit(limits.failedAuth, { key: byClientAddress, counts: COUNTED_RESPONSES.UNAUTHORIZED }),
      requireAuth: createRequireAuth(verifyToken),
      teacherLimit: createTeacherRateLimit(limits),
      expensiveLimit: createRateLimit(limits.expensive, { key: byTeacher }),
      publicAppUrl: env.PUBLIC_APP_URL,
      logger,
      auth: auth === undefined ? undefined : authRoutesFor(auth, env, limits, signInDelayStepMs),
    }),
  )
  app.use(notFound)
  app.use(createErrorHandler(logger))

  return app
}
