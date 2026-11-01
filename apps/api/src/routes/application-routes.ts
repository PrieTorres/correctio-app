import express, { Router, type RequestHandler } from 'express'
import type { Kysely } from 'kysely'
import type { Logger } from 'pino'
import { createApplicationController } from '../controllers/application-controller'
import { createCorrectionController } from '../controllers/correction-controller'
import { createGenerationController } from '../controllers/generation-controller'
import { createPrintingController } from '../controllers/printing-controller'
import type { ReportController } from '../controllers/report-controller'
import { createSheetImageController } from '../controllers/sheet-image-controller'
import type { FileStorage } from '../lib/file-storage'
import type { PhotoReader } from '../lib/sheet-reading/photo-reader'
import { PHOTO_BODY_LIMIT_BYTES } from '../middlewares/body-limit'
import type { Database } from '../models/tables'
import { createActivityLogRepository } from '../repositories/activity-log-repository'
import { createApplicationRepository, type ApplicationRepository } from '../repositories/application-repository'
import { createClassRepository } from '../repositories/class-repository'
import { createCorrectionRepository } from '../repositories/correction-repository'
import { createExamRepository } from '../repositories/exam-repository'
import { createGradingRepository } from '../repositories/grading-repository'
import { createPrintingRepository, type PrintingRepository } from '../repositories/printing-repository'
import { QuestionRepository } from '../repositories/question-repository'
import { createSheetImageRepository } from '../repositories/sheet-image-repository'
import { createApplicationService } from '../services/application-service'
import { createCorrectionService } from '../services/correction-service'
import { createExamService } from '../services/exam-service'
import { createGenerationService } from '../services/generation-service'
import { createPrintingService } from '../services/printing-service'
import { createSheetImageService } from '../services/sheet-image-service'
import { onlyWhenExporting } from './report-routes'

export interface ApplicationRouteDependencies {
  db: Kysely<Database>
  /** Where the PDF of each application is kept (`docs/adr/ADR-004`). */
  fileStorage: FileStorage
  /** The expensive tier, per teacher, for generating the PDF and exporting the report (`docs/Seguranca_e_LGPD.md`, section 4). */
  expensiveLimit: RequestHandler
  /** The origin of the web app, printed in the QR code of every sheet (`PUBLIC_APP_URL`). */
  publicAppUrl: string
  /** Reads the photo of a sheet off the thread that answers requests (ADR-007). */
  readPhoto: PhotoReader
  logger: Logger
  /** The report of each application (P18), shared with `/dashboard` and `/reports` (#50). */
  reports: ReportController
}

interface Repositories {
  applications: ApplicationRepository
  printing: PrintingRepository
}

/** The exam is read through its own service, with the questions in the order the teacher set, and marked `ready` there. */
function generationController(
  { db, fileStorage, publicAppUrl, logger }: ApplicationRouteDependencies,
  { applications, printing }: Repositories,
) {
  const questions = new QuestionRepository(db)
  return createGenerationController(
    createGenerationService({
      applications,
      printing,
      exams: createExamService({ exams: createExamRepository(db), questions }),
      classes: createClassRepository(db),
      questions,
      fileStorage,
      publicAppUrl,
      logger,
    }),
  )
}

/**
 * Applications and what was printed for them (P11 to P14), the photos
 * and corrections of their sheets (P15 to P17, #47) and their report (P18, #50). `ExamAssignment` gets no
 * route: the answer sheets took its place, and it stays in the contract only
 * for a student area (`docs/Modelo_de_Dados.md`).
 */
export function applicationRoutes(dependencies: ApplicationRouteDependencies): Router {
  const { db, fileStorage, expensiveLimit } = dependencies
  const repositories: Repositories = { applications: createApplicationRepository(db), printing: createPrintingRepository(db) }
  const applications = createApplicationController(
    createApplicationService({
      applications: repositories.applications,
      exams: createExamRepository(db),
      classes: createClassRepository(db),
      fileStorage,
    }),
  )
  const generation = generationController(dependencies, repositories)
  const printing = createPrintingController(createPrintingService(repositories))
  const sheetImageRepository = createSheetImageRepository(db)
  const corrections = createCorrectionController(
    createCorrectionService({
      ...repositories,
      grading: createGradingRepository(db),
      corrections: createCorrectionRepository(db),
      sheetImages: sheetImageRepository,
    }),
  )
  const sheetImages = createSheetImageController(
    createSheetImageService({
      ...repositories,
      sheetImages: sheetImageRepository,
      activityLog: createActivityLogRepository(db),
      fileStorage,
      readPhoto: dependencies.readPhoto,
      logger: dependencies.logger,
    }),
  )
  /** Any content type: the photo is told apart by its own bytes in the service, never by what the client declares. */
  const photoBody = express.raw({ type: () => true, limit: PHOTO_BODY_LIMIT_BYTES })

  const router = Router()
  router.get('/', applications.list)
  router.post('/', applications.create)
  router.get('/:id', applications.get)
  router.patch('/:id', applications.update)
  router.patch('/:id/archive', applications.archive)
  router.patch('/:id/restore', applications.restore)
  router.post('/:id/generate-pdf', expensiveLimit, generation.generatePdf)
  router.post('/:id/grades-release', applications.releaseGrades)
  router.get('/:id/pdf', applications.downloadPdf)

  router.get('/:id/versions', printing.listVersions)
  router.post('/:id/versions/:versionId/publish-answer-key', printing.publishAnswerKey)
  router.post('/:id/publish-answer-keys', printing.publishAllAnswerKeys)
  router.get('/:id/sheets', printing.listSheets)
  router.get('/:id/report', onlyWhenExporting(expensiveLimit), dependencies.reports.applicationReport)

  router.post('/:id/sheet-images', photoBody, sheetImages.upload)
  router.get('/:id/sheet-images/:imageId', sheetImages.image)
  router.get('/:id/read-failures', sheetImages.readFailures)

  router.get('/:id/corrections', corrections.list)
  router.post('/:id/corrections', corrections.create)
  router.get('/:id/corrections/:correctionId', corrections.get)
  router.patch('/:id/corrections/:correctionId', corrections.update)
  return router
}
