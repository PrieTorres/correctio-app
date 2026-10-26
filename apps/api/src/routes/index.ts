import { Router, type RequestHandler } from 'express'
import type { Kysely } from 'kysely'
import type { Logger } from 'pino'
import type { AuthController } from '../controllers/auth-controller'
import type { FieldCipher } from '../lib/field-encryption'
import type { FileStorage } from '../lib/file-storage'
import type { AuthLimits } from '../middlewares/rate-limit'
import type { Database } from '../models/tables'
import type { HealthService } from '../services/health-service'
import { applicationRoutes } from './application-routes'
import { meRoutes, publicAuthRoutes, signedInAuthRoutes } from './auth-routes'
import { classRoutes } from './class-routes'
import { examRoutes } from './exam-routes'
import { healthRoutes } from './health-routes'
import { questionRoutes } from './question-routes'

export interface RouteDependencies {
  healthService: HealthService
  db: Kysely<Database>
  fieldCipher: FieldCipher
  fileStorage: FileStorage
  /** Counts refused tokens per address, ahead of the gate, against guessing. */
  failedAuthLimit: RequestHandler
  requireAuth: RequestHandler
  /** Per-teacher budgets, behind the gate, where the teacher is known. */
  teacherLimit: RequestHandler
  /** The expensive tier, per teacher, which each costly route applies on its own. */
  expensiveLimit: RequestHandler
  /** The origin of the web app, which the PDF prints in every QR code (`PUBLIC_APP_URL`). */
  publicAppUrl: string
  logger: Logger
  /** Absent in tests that exercise only the gate, which then answers every route as before #40. */
  auth?: { controller: AuthController; limits: AuthLimits }
}

/**
 * Public routes first, then the gate. Everything mounted after `requireAuth`
 * needs a token, including a path that does not exist, so a new endpoint is
 * closed unless someone opens it on purpose. Only `/health`, the sign-in routes
 * and the public lookup of #49 belong above the gate.
 */
export function createRouter({
  healthService,
  db,
  fieldCipher,
  fileStorage,
  failedAuthLimit,
  requireAuth,
  teacherLimit,
  expensiveLimit,
  publicAppUrl,
  logger,
  auth,
}: RouteDependencies): Router {
  const router = Router()

  router.use('/health', healthRoutes(healthService))
  if (auth !== undefined) router.use('/auth', publicAuthRoutes(auth.controller, auth.limits))

  router.use(failedAuthLimit, requireAuth, teacherLimit)

  if (auth !== undefined) {
    router.use('/auth', signedInAuthRoutes(auth.controller))
    router.use('/me', meRoutes(auth.controller))
  }
  router.use('/questions', questionRoutes(db))
  router.use('/classes', classRoutes({ db, fieldCipher, expensiveLimit }))
  router.use('/exams', examRoutes(db))
  router.use('/applications', applicationRoutes({ db, fileStorage, expensiveLimit, publicAppUrl, logger }))

  return router
}
