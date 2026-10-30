import type { RequestHandler } from 'express'
import { currentTeacherId } from '../middlewares/require-auth'
import type { ReportService } from '../services/report-service'

/** A type alias rather than an interface, for the same reason as in the student controller. */
type ApplicationParams = { id: string }

export interface ReportController {
  dashboard: RequestHandler
  applicationReport: RequestHandler<ApplicationParams>
  consolidated: RequestHandler
}

/** Request in, service call, answer out: the numbers are worked out in the service. */
export function createReportController(service: ReportService): ReportController {
  return {
    async dashboard(_req, res) {
      res.json(await service.dashboard(currentTeacherId(res)))
    },

    async applicationReport(req, res) {
      res.json(await service.applicationReport(currentTeacherId(res), req.params.id))
    },

    async consolidated(_req, res) {
      res.json(await service.consolidated(currentTeacherId(res)))
    },
  }
}
