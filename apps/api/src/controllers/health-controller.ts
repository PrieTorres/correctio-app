import type { RequestHandler } from 'express'
import { HEALTH_STATUS, type HealthService } from '../services/health-service'

/** 503 when a dependency is down, so a deploy probe or uptime monitor sees it without reading the body. */
export function createHealthController(service: HealthService): RequestHandler {
  return async (_req, res) => {
    const report = await service.check()
    res.status(report.status === HEALTH_STATUS.UP ? 200 : 503).json(report)
  }
}
