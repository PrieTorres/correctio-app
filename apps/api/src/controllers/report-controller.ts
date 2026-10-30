import type { RequestHandler, Response } from 'express'
import type { ReportFile } from '../lib/report-export'
import { currentTeacherId } from '../middlewares/require-auth'
import { exportFormatOf, type ReportService } from '../services/report-service'

/** A type alias rather than an interface, for the same reason as in the student controller. */
type ApplicationParams = { id: string }

export interface ReportController {
  dashboard: RequestHandler
  applicationReport: RequestHandler<ApplicationParams>
  consolidated: RequestHandler
}

/** `attachment` names the file in `Content-Disposition`; the type is set after it, since it guesses one from the name. */
function sendFile(res: Response, { filename, contentType, content }: ReportFile): void {
  res.attachment(filename).type(contentType).send(content)
}

/**
 * Request in, service call, answer out: the numbers are worked out in the
 * service. Without `format`, a report route answers the JSON the screens
 * read; with it, the file of RF36, from the same numbers.
 */
export function createReportController(service: ReportService): ReportController {
  return {
    async dashboard(_req, res) {
      res.json(await service.dashboard(currentTeacherId(res)))
    },

    async applicationReport(req, res) {
      const teacherId = currentTeacherId(res)
      const format = exportFormatOf(req.query)
      if (format === undefined) res.json(await service.applicationReport(teacherId, req.params.id))
      else sendFile(res, await service.exportApplicationReport(teacherId, req.params.id, format))
    },

    async consolidated(req, res) {
      const teacherId = currentTeacherId(res)
      const format = exportFormatOf(req.query)
      if (format === undefined) res.json(await service.consolidated(teacherId, req.query))
      else sendFile(res, await service.exportConsolidated(teacherId, req.query, format))
    },
  }
}
