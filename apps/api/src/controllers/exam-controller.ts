import type { RequestHandler } from 'express'
import { currentTeacherId } from '../middlewares/require-auth'
import type { ExamService } from '../services/exam-service'

/** An alias rather than an interface, as in the class controller. */
type ExamParams = { id: string }

export interface ExamController {
  list: RequestHandler
  get: RequestHandler<ExamParams>
  create: RequestHandler
  update: RequestHandler<ExamParams>
  archive: RequestHandler<ExamParams>
  restore: RequestHandler<ExamParams>
  markReady: RequestHandler<ExamParams>
  draw: RequestHandler
}

/** Reads the request, hands the teacher of the token to the service and writes the answer; nothing here decides. */
export function createExamController(service: ExamService): ExamController {
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

    async markReady(req, res) {
      await service.markReady(currentTeacherId(res), req.params.id)
      res.status(204).end()
    },

    async draw(req, res) {
      res.json(await service.draw(currentTeacherId(res), req.body))
    },
  }
}
