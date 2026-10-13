import { Router } from 'express'
import { createHealthController } from '../controllers/health-controller'
import type { HealthService } from '../services/health-service'

export function healthRoutes(service: HealthService): Router {
  const router = Router()
  router.get('/', createHealthController(service))
  return router
}
