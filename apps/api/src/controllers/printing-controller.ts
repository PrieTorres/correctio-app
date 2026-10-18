import type { RequestHandler } from 'express'
import { currentTeacherId } from '../middlewares/require-auth'
import type { PrintingService } from '../services/printing-service'

/** Type aliases rather than interfaces, for the same reason as in the student controller. */
type ApplicationParams = { id: string }

type VersionParams = ApplicationParams & { versionId: string }

export interface PrintingController {
  listVersions: RequestHandler<ApplicationParams>
  listSheets: RequestHandler<ApplicationParams>
  publishAnswerKey: RequestHandler<VersionParams>
}

/** Versions and sheets live under their application in every path, as students do under their class. */
export function createPrintingController(service: PrintingService): PrintingController {
  return {
    async listVersions(req, res) {
      res.json(await service.listVersions(currentTeacherId(res), req.params.id, req.query))
    },

    async listSheets(req, res) {
      res.json(await service.listSheets(currentTeacherId(res), req.params.id, req.query))
    },

    async publishAnswerKey(req, res) {
      const path = { applicationId: req.params.id, versionId: req.params.versionId }
      await service.publishAnswerKey(currentTeacherId(res), path, req.body)
      res.status(204).end()
    },
  }
}
