import type { RequestHandler } from 'express'
import { currentTeacherId } from '../middlewares/require-auth'
import type { GenerationService } from '../services/generation-service'

/** A type alias rather than an interface, for the same reason as in the student controller. */
type ApplicationParams = { id: string }

export interface GenerationController {
  generatePdf: RequestHandler<ApplicationParams>
}

/** The generation answers what it printed, so the screen shows the new versions and sheets without asking again. */
export function createGenerationController(service: GenerationService): GenerationController {
  return {
    async generatePdf(req, res) {
      res.json(await service.generate(currentTeacherId(res), req.params.id, req.body))
    },
  }
}
