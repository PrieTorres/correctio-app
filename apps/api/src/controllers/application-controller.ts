import type { RequestHandler } from 'express'
import { currentTeacherId } from '../middlewares/require-auth'
import type { ApplicationService } from '../services/application-service'

/** An alias rather than an interface, so a plain middleware can share the route (see the student controller). */
type ApplicationParams = { id: string }

export interface ApplicationController {
  list: RequestHandler
  get: RequestHandler<ApplicationParams>
  create: RequestHandler
  update: RequestHandler<ApplicationParams>
  archive: RequestHandler<ApplicationParams>
  restore: RequestHandler<ApplicationParams>
  releaseGrades: RequestHandler<ApplicationParams>
  downloadPdf: RequestHandler<ApplicationParams>
}

/** Same role as the class controller: request in, service call, answer out. */
export function createApplicationController(service: ApplicationService): ApplicationController {
  return {
    async list(req, res) {
      res.json(await service.list(currentTeacherId(res), req.query))
    },

    async get(req, res) {
      res.json(await service.get(currentTeacherId(res), req.params.id))
    },

    async create(req, res) {
      res.status(201).json(await service.create(currentTeacherId(res), req.body))
    },

    async update(req, res) {
      res.json(await service.update(currentTeacherId(res), req.params.id, req.body))
    },

    async archive(req, res) {
      await service.archive(currentTeacherId(res), req.params.id)
      res.status(204).end()
    },

    async restore(req, res) {
      await service.restore(currentTeacherId(res), req.params.id)
      res.status(204).end()
    },

    async releaseGrades(req, res) {
      res.json(await service.releaseGrades(currentTeacherId(res), req.params.id, req.body))
    },

    /** `attachment` names the file and sets its type from the extension, so the browser saves a PDF. */
    async downloadPdf(req, res) {
      const { filename, content } = await service.downloadPdf(currentTeacherId(res), req.params.id)
      res.attachment(filename).send(content)
    },
  }
}
