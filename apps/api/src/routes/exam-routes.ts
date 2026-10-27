import { Router } from 'express'
import type { Kysely } from 'kysely'
import { createExamController } from '../controllers/exam-controller'
import type { Database } from '../models/tables'
import { createExamRepository } from '../repositories/exam-repository'
import { QuestionRepository } from '../repositories/question-repository'
import { createExamService } from '../services/exam-service'

/**
 * Exams (P8 to P10) and the automatic draw (P9b, RF16). The draw stores
 * nothing: the selection only becomes part of an exam when the teacher saves
 * it. Its path is matched before `/:id`, so `draw` is never read as an id.
 * `ready` takes no body: it only moves a draft to `ready`, and the screen
 * calls it after generating an application.
 */
export function examRoutes(db: Kysely<Database>): Router {
  const exams = createExamController(createExamService({ exams: createExamRepository(db), questions: new QuestionRepository(db) }))

  const router = Router()
  router.get('/', exams.list)
  router.post('/', exams.create)
  router.post('/draw', exams.draw)
  router.get('/:id', exams.get)
  router.patch('/:id', exams.update)
  router.patch('/:id/archive', exams.archive)
  router.patch('/:id/restore', exams.restore)
  router.patch('/:id/ready', exams.markReady)
  return router
}
