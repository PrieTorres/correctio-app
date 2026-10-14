import { Router, type RequestHandler } from 'express'
import type { Kysely } from 'kysely'
import type { FieldCipher } from '../lib/field-encryption'
import type { Database } from '../models/tables'
import type { HealthService } from '../services/health-service'
import { classRoutes } from './class-routes'
import { healthRoutes } from './health-routes'

export interface RouteDependencies {
  healthService: HealthService
  db: Kysely<Database>
  fieldCipher: FieldCipher
  /** Counts refused tokens per address, ahead of the gate, against guessing. */
  failedAuthLimit: RequestHandler
  requireAuth: RequestHandler
  /** Per-teacher budgets, behind the gate, where the teacher is known. */
  teacherLimit: RequestHandler
  /** The expensive tier, per teacher, which each costly route applies on its own. */
  expensiveLimit: RequestHandler
}

/**
 * Public routes first, then the gate. Everything mounted after `requireAuth`
 * needs a token, including a path that does not exist, so a new endpoint is
 * closed unless someone opens it on purpose. Only `/health`, the sign-in routes
 * of #40 and the public lookup of #49 belong above the gate.
 */
export function createRouter({
  healthService,
  db,
  fieldCipher,
  failedAuthLimit,
  requireAuth,
  teacherLimit,
  expensiveLimit,
}: RouteDependencies): Router {
  const router = Router()
  router.use('/health', healthRoutes(healthService))
  router.use(failedAuthLimit, requireAuth, teacherLimit)
  router.use('/classes', classRoutes({ db, fieldCipher, expensiveLimit }))
  return router
}
