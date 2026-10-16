import type { RequestHandler } from 'express'
import { currentTeacherId } from '../middlewares/require-auth'
import type { ClassService } from '../services/class-service'

/** An alias rather than an interface, so a plain middleware can share the route (see the student controller). */
type ClassParams = { id: string }

export interface ClassController {
  list: RequestHandler
  get: RequestHandler<ClassParams>
  create: RequestHandler
  update: RequestHandler<ClassParams>
  archive: RequestHandler<ClassParams>
  restore: RequestHandler<ClassParams>
}

/**
 * Reads the request, hands the teacher of the token to the service and writes
 * the answer; nothing here decides. A thrown `ApiError` reaches the error
 * handler on its own, since Express 5 forwards a rejected handler.
 */
export function createClassController(service: ClassService): ClassController {
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
  }
}
