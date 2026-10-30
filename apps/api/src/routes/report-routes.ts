import { Router } from 'express'
import type { Kysely } from 'kysely'
import { createReportController, type ReportController } from '../controllers/report-controller'
import type { Database } from '../models/tables'
import { createReportRepository } from '../repositories/report-repository'
import { createReportService } from '../services/report-service'

/** One controller for the three places the reports answer: the panel, `/reports` and the report under each application. */
export function createReports(db: Kysely<Database>): ReportController {
  return createReportController(createReportService({ reports: createReportRepository(db) }))
}

/** `GET /dashboard`: the counts and the latest applications of P1. */
export function dashboardRoutes(reports: ReportController): Router {
  const router = Router()
  router.get('/', reports.dashboard)
  return router
}

/** `GET /reports/consolidated`: one row per application with a grade (P19). */
export function reportRoutes(reports: ReportController): Router {
  const router = Router()
  router.get('/consolidated', reports.consolidated)
  return router
}
