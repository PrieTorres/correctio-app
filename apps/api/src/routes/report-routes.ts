import { Router, type RequestHandler } from 'express'
import type { Kysely } from 'kysely'
import { createReportController, type ReportController } from '../controllers/report-controller'
import type { Database } from '../models/tables'
import { createReportRepository } from '../repositories/report-repository'
import { createReportService } from '../services/report-service'

/** One controller for the three places the reports answer: the panel, `/reports` and the report under each application. */
export function createReports(db: Kysely<Database>): ReportController {
  return createReportController(createReportService({ reports: createReportRepository(db) }))
}

/**
 * The expensive tier applies to the export only (`docs/Seguranca_e_LGPD.md`,
 * section 4): the same route without `format` is the screen reading its
 * numbers, an ordinary read.
 */
export function onlyWhenExporting(limit: RequestHandler): RequestHandler {
  return (req, res, next) => {
    if (req.query.format === undefined) next()
    else void limit(req, res, next)
  }
}

/** `GET /dashboard`: the counts and the latest applications of P1. */
export function dashboardRoutes(reports: ReportController): Router {
  const router = Router()
  router.get('/', reports.dashboard)
  return router
}

/** `GET /reports/consolidated`: one row per application with a grade (P19), or its file with `?format=` (RF36). */
export function reportRoutes(reports: ReportController, expensiveLimit: RequestHandler): Router {
  const router = Router()
  router.get('/consolidated', onlyWhenExporting(expensiveLimit), reports.consolidated)
  return router
}
