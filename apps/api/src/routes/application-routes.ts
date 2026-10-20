import { Router } from 'express'
import type { Kysely } from 'kysely'
import { createApplicationController } from '../controllers/application-controller'
import { createCorrectionController } from '../controllers/correction-controller'
import { createPrintingController } from '../controllers/printing-controller'
import type { FileStorage } from '../lib/file-storage'
import type { Database } from '../models/tables'
import { createApplicationRepository } from '../repositories/application-repository'
import { createCorrectionRepository } from '../repositories/correction-repository'
import { createGradingRepository } from '../repositories/grading-repository'
import { createPrintingRepository } from '../repositories/printing-repository'
import { createApplicationService } from '../services/application-service'
import { createCorrectionService } from '../services/correction-service'
import { createPrintingService } from '../services/printing-service'

export interface ApplicationRouteDependencies {
  db: Kysely<Database>
  /** Where the PDF of each application is kept (`docs/adr/ADR-004`). */
  fileStorage: FileStorage
}

/**
 * Applications and what was printed for them (P11 and P14). Creating, editing
 * and generating the PDF read the exam, so they arrive with the exams of #45;
 * everything here works on applications that already exist, and so do the
 * corrections of their sheets (P15 to P17, #47). `ExamAssignment`
 * gets no route: the answer sheets took its place, and it stays in the
 * contract only for a student area (`docs/Modelo_de_Dados.md`).
 */
export function applicationRoutes({ db, fileStorage }: ApplicationRouteDependencies): Router {
  const applicationRepository = createApplicationRepository(db)
  const printingRepository = createPrintingRepository(db)
  const applications = createApplicationController(
    createApplicationService({ applications: applicationRepository, fileStorage }),
  )
  const printing = createPrintingController(
    createPrintingService({ applications: applicationRepository, printing: printingRepository }),
  )
  const corrections = createCorrectionController(
    createCorrectionService({
      applications: applicationRepository,
      printing: printingRepository,
      grading: createGradingRepository(db),
      corrections: createCorrectionRepository(db),
    }),
  )

  const router = Router()
  router.get('/', applications.list)
  router.get('/:id', applications.get)
  router.patch('/:id/archive', applications.archive)
  router.patch('/:id/restore', applications.restore)
  router.post('/:id/grades-release', applications.releaseGrades)
  router.get('/:id/pdf', applications.downloadPdf)

  router.get('/:id/versions', printing.listVersions)
  router.post('/:id/versions/:versionId/publish-answer-key', printing.publishAnswerKey)
  router.get('/:id/sheets', printing.listSheets)

  router.get('/:id/corrections', corrections.list)
  router.post('/:id/corrections', corrections.create)
  router.get('/:id/corrections/:correctionId', corrections.get)
  router.patch('/:id/corrections/:correctionId', corrections.update)
  return router
}
