import type { RequestHandler } from 'express'
import { currentTeacherId } from '../middlewares/require-auth'
import type { GradeLinkService } from '../services/grade-link-service'

export interface GradeLinkController {
  send: RequestHandler<{ id: string }>
}

/** Request in, service call, the counts out. */
export function createGradeLinkController(service: GradeLinkService): GradeLinkController {
  return {
    async send(req, res) {
      res.json(await service.sendLinks(currentTeacherId(res), req.params.id))
    },
  }
}
