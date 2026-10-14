import { Router, type RequestHandler } from 'express'
import type { Kysely } from 'kysely'
import { createClassController } from '../controllers/class-controller'
import { createStudentController } from '../controllers/student-controller'
import type { FieldCipher } from '../lib/field-encryption'
import type { Database } from '../models/tables'
import { createClassRepository } from '../repositories/class-repository'
import { createStudentRepository } from '../repositories/student-repository'
import { createClassService } from '../services/class-service'
import { createStudentService } from '../services/student-service'

export interface ClassRouteDependencies {
  db: Kysely<Database>
  /** Encrypts the student e-mail at rest. */
  fieldCipher: FieldCipher
  /** The expensive tier, per teacher, for the bulk import (`docs/Seguranca_e_LGPD.md`, section 4). */
  expensiveLimit: RequestHandler
}

/**
 * Classes and their students (P3, P4 and P5). Students hang under the class in
 * every path, so each of their routes starts from a class the teacher owns.
 * `inviteCode` and `ClassEnrollment` get no route: they serve a student area
 * this project does not build (`docs/Arquitetura.md`, section 9).
 */
export function classRoutes({ db, fieldCipher, expensiveLimit }: ClassRouteDependencies): Router {
  const classRepository = createClassRepository(db)
  const classes = createClassController(createClassService({ repository: classRepository }))
  const students = createStudentController(
    createStudentService({ classes: classRepository, students: createStudentRepository(db, fieldCipher) }),
  )

  const router = Router()
  router.get('/', classes.list)
  router.post('/', classes.create)
  router.get('/:id', classes.get)
  router.patch('/:id', classes.update)
  router.patch('/:id/archive', classes.archive)
  router.patch('/:id/restore', classes.restore)

  router.get('/:id/students', students.list)
  router.post('/:id/students', students.add)
  router.post('/:id/students/import', expensiveLimit, students.importMany)
  router.patch('/:id/students/:studentId', students.update)
  router.delete('/:id/students/:studentId', students.remove)
  router.post('/:id/students/:studentId/anonymize', students.anonymize)
  return router
}
