import type { RequestHandler } from 'express'
import { currentTeacherId } from '../middlewares/require-auth'
import type { StudentService } from '../services/student-service'

/**
 * Students live under their class in every path, so the class is always the
 * first thing checked. Type aliases rather than interfaces: only an alias fits
 * the index signature of a plain middleware, such as the import rate limit.
 */
type ClassParams = { id: string }

type StudentParams = ClassParams & { studentId: string }

export interface StudentController {
  list: RequestHandler<ClassParams>
  add: RequestHandler<ClassParams>
  importMany: RequestHandler<ClassParams>
  update: RequestHandler<StudentParams>
  remove: RequestHandler<StudentParams>
  anonymize: RequestHandler<StudentParams>
}

/** Same role as the class controller: request in, service call, answer out. */
export function createStudentController(service: StudentService): StudentController {
  return {
    async list(req, res) {
      res.json(await service.list(currentTeacherId(res), req.params.id, req.query))
    },

    async add(req, res) {
      res.status(201).json(await service.add(currentTeacherId(res), req.params.id, req.body))
    },

    async importMany(req, res) {
      res.json(await service.importMany(currentTeacherId(res), req.params.id, req.body))
    },

    async update(req, res) {
      res.json(await service.update(currentTeacherId(res), req.params.id, req.params.studentId, req.body))
    },

    async remove(req, res) {
      await service.remove(currentTeacherId(res), req.params.id, req.params.studentId)
      res.status(204).end()
    },

    async anonymize(req, res) {
      await service.anonymize(currentTeacherId(res), req.params.id, req.params.studentId)
      res.status(204).end()
    },
  }
}
