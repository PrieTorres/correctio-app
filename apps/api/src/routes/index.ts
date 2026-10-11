import { Router, type RequestHandler } from 'express'
import type { HealthService } from '../services/health-service'
import { healthRoutes } from './health-routes'

export interface RouteDependencies {
  healthService: HealthService
  requireAuth: RequestHandler
}

/**
 * Public routes first, then the gate. Everything mounted after `requireAuth`
 * needs a token, including a path that does not exist, so a new endpoint is
 * closed unless someone opens it on purpose. Only `/health`, the sign-in routes
 * of #40 and the public lookup of #49 belong above the gate.
 */
export function createRouter({ healthService, requireAuth }: RouteDependencies): Router {
  const router = Router()
  router.use('/health', healthRoutes(healthService))
  router.use(requireAuth)
  return router
}
