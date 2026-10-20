import type { RequestHandler } from 'express'
import { currentTeacherId } from '../middlewares/require-auth'
import type { CorrectionService } from '../services/correction-service'

/** Type aliases rather than interfaces, for the same reason as in the student controller. */
type ApplicationParams = { id: string }

type CorrectionParams = ApplicationParams & { correctionId: string }

export interface CorrectionController {
  list: RequestHandler<ApplicationParams>
  get: RequestHandler<CorrectionParams>
  create: RequestHandler<ApplicationParams>
  update: RequestHandler<CorrectionParams>
}

/** Corrections live under their application, as the Spec's section 7 writes the paths. */
export function createCorrectionController(service: CorrectionService): CorrectionController {
  const pathOf = (params: CorrectionParams) => ({ applicationId: params.id, correctionId: params.correctionId })

  return {
    async list(req, res) {
      res.json(await service.list(currentTeacherId(res), req.params.id, req.query))
    },

    async get(req, res) {
      res.json(await service.get(currentTeacherId(res), pathOf(req.params)))
    },

    async create(req, res) {
      res.status(201).json(await service.create(currentTeacherId(res), req.params.id, req.body))
    },

    async update(req, res) {
      res.json(await service.update(currentTeacherId(res), pathOf(req.params), req.body))
    },
  }
}
