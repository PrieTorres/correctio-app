import { randomUUID } from 'node:crypto'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Kysely } from 'kysely'
import type { Logger } from 'pino'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDatabase, DATABASE_TEST_URL, type TestDatabase } from '../../__tests__/test-database'
import { createLocalFileStorage, type FileStorage } from '../../lib/file-storage'
import type { Database } from '../../models/tables'
import { createApplicationRepository } from '../../repositories/application-repository'
import { createClassRepository } from '../../repositories/class-repository'
import { createExamRepository } from '../../repositories/exam-repository'
import { createPrintingRepository, type PrintingRepository } from '../../repositories/printing-repository'
import { QuestionRepository } from '../../repositories/question-repository'
import { createExamService, type ExamService } from '../exam-service'
import { createGenerationService, type GenerationServiceDependencies } from '../generation-service'

const REQUEST = { versions: [{ shuffleQuestions: false, shuffleAlternatives: false }], withStudentIdentification: true }

function spyLogger() {
  const logger = { error: vi.fn() }
  return { logger, asLogger: logger as unknown as Logger }
}

/**
 * The steps around the swap of the paper that the routes cannot reach: what
 * happens to the PDF drawn for a generation that ends up refused or failed,
 * and to the work after the commit when it fails. The routes cover the rest.
 */
describe.runIf(DATABASE_TEST_URL !== undefined)('generation service (real MySQL)', () => {
  let database: TestDatabase
  let db: Kysely<Database>
  let folder: string
  let fileStorage: FileStorage
  let examService: ExamService

  beforeAll(async () => {
    database = await createTestDatabase()
    db = database.db
    await db.insertInto('users').values({ id: 'ana', role: 'professor', fullName: 'Ana', email: 'ana@exemplo.edu.br', passwordHash: 'x' }).execute()
    await db
      .insertInto('classes')
      .values({ id: 'class-ana', teacherId: 'ana', name: 'Cálculo I', subject: 'Matemática', term: '2026/2', status: 'active', inviteCode: 'CALCULO1' })
      .execute()
    await db
      .insertInto('students')
      .values([
        { id: 's-1', classId: 'class-ana', fullName: 'Ana Beatriz', registration: '1', email: null, userId: null },
        { id: 's-2', classId: 'class-ana', fullName: 'Bruno Alves', registration: '2', email: null, userId: null },
      ])
      .execute()
    await db
      .insertInto('questions')
      .values({ id: 'q-1', teacherId: 'ana', type: 'objetiva', statement: 'Quanto é 2 + 2?', correctAlternativeId: 'q-1-a', maxScore: null, deletedAt: null, allowShuffleAlternatives: true })
      .execute()
    await db
      .insertInto('question_alternatives')
      .values([
        { questionId: 'q-1', id: 'q-1-a', text: '4', position: 0 },
        { questionId: 'q-1', id: 'q-1-b', text: '5', position: 1 },
      ])
      .execute()
    await db
      .insertInto('exams')
      .values({ id: 'exam-ana', teacherId: 'ana', title: 'Prova 1', description: '', status: 'draft', defaultShuffleQuestions: false, defaultShuffleAlternatives: false })
      .execute()
    await db.insertInto('exam_questions').values({ examId: 'exam-ana', questionId: 'q-1', order: 0, score: 10, allowShuffleAlternatives: true }).execute()

    folder = await mkdtemp(join(tmpdir(), 'correctio-files-'))
    fileStorage = createLocalFileStorage(folder)
    examService = createExamService({ exams: createExamRepository(db), questions: new QuestionRepository(db) })
  })

  afterAll(async () => {
    await database.drop()
    await rm(folder, { recursive: true, force: true })
  })

  beforeEach(async () => {
    await db.deleteFrom('corrections').execute()
    await db.deleteFrom('answer_sheets').execute()
    await db.deleteFrom('exam_versions').execute()
    await db.deleteFrom('applications').execute()
  })

  function serviceWith(overrides: Partial<GenerationServiceDependencies> = {}) {
    const questions = new QuestionRepository(db)
    return createGenerationService({
      applications: createApplicationRepository(db),
      printing: createPrintingRepository(db),
      exams: examService,
      classes: createClassRepository(db),
      questions,
      fileStorage,
      publicAppUrl: 'https://correctio-app.web.app',
      logger: spyLogger().asLogger,
      ...overrides,
    })
  }

  async function insertApplication(): Promise<string> {
    const id = randomUUID()
    await db
      .insertInto('applications')
      .values({ id, examId: 'exam-ana', classId: 'class-ana', teacherId: 'ana', status: 'draft', pdfUrl: null, date: new Date('2026-10-05T12:00:00.000Z'), gradesReleased: false })
      .execute()
    return id
  }

  async function correctFirstSheetOf(applicationId: string) {
    const sheet = await db.selectFrom('answer_sheets').selectAll().where('applicationId', '=', applicationId).where('sheetNumber', '=', 1).executeTakeFirstOrThrow()
    await db
      .insertInto('corrections')
      .values({
        id: randomUUID(),
        examVersionId: sheet.examVersionId,
        studentId: sheet.studentId,
        reportedStudentName: null,
        reportedStudentRegistration: null,
        totalScore: 0,
        notes: null,
        confirmedAt: new Date(),
        correctedBy: 'ana',
        isAutomaticallyAssigned: true,
        clientCorrectionId: randomUUID(),
        syncStatus: 'synced',
        answerSheetId: sheet.id,
        source: 'MANUAL',
        status: 'IN_PROGRESS',
        imageUrl: null,
      })
      .execute()
  }

  async function filesOf(applicationId: string): Promise<string[]> {
    return readdir(join(folder, 'applications', applicationId)).catch(() => [])
  }

  it('refuses before drawing or storing anything when a correction already stands in the way', async () => {
    const id = await insertApplication()
    await serviceWith().generate('ana', id, REQUEST)
    await correctFirstSheetOf(id)
    const save = vi.fn(fileStorage.save)

    await expect(serviceWith({ fileStorage: { ...fileStorage, save } }).generate('ana', id, REQUEST)).rejects.toMatchObject({ status: 409 })
    expect(save).not.toHaveBeenCalled()
  })

  /** The correction arrives after the first look, so only the check under lock sees it: the PDF drawn for nothing goes. */
  it('removes the PDF it stored when the swap is refused under lock', async () => {
    const id = await insertApplication()
    await serviceWith().generate('ana', id, REQUEST)
    const files = await filesOf(id)
    await correctFirstSheetOf(id)
    const printing = createPrintingRepository(db)
    const lateCorrection: PrintingRepository = { ...printing, correctionsOf: () => Promise.resolve([]) }

    await expect(serviceWith({ printing: lateCorrection }).generate('ana', id, REQUEST)).rejects.toMatchObject({ status: 409 })
    expect(await filesOf(id)).toEqual(files)
  })

  it('removes the PDF it stored when the swap fails, and answers the failure', async () => {
    const id = await insertApplication()
    const printing = createPrintingRepository(db)
    const failing: PrintingRepository = { ...printing, replacePaper: () => Promise.reject(new Error('connection lost')) }

    await expect(serviceWith({ printing: failing }).generate('ana', id, REQUEST)).rejects.toThrow('connection lost')
    expect(await filesOf(id)).toEqual([])
  })

  it('logs, without failing, a replaced PDF it could not remove', async () => {
    const id = await insertApplication()
    await serviceWith().generate('ana', id, REQUEST)
    const { logger, asLogger } = spyLogger()
    const stuck: FileStorage = { ...fileStorage, remove: () => Promise.reject(new Error('permission denied')) }

    const paper = await serviceWith({ fileStorage: stuck, logger: asLogger }).generate('ana', id, REQUEST)

    expect(paper.sheets).toHaveLength(2)
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ key: expect.stringContaining(id) as string }), 'A PDF no application points at was not removed')
  })

  it('logs, without failing, an exam it could not mark ready', async () => {
    const id = await insertApplication()
    const { logger, asLogger } = spyLogger()
    const exams = { get: examService.get, markReady: () => Promise.reject(new Error('database gone')) }

    const paper = await serviceWith({ exams, logger: asLogger }).generate('ana', id, REQUEST)

    expect(paper.versions).toHaveLength(1)
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ examId: 'exam-ana' }),
      'The exam was not marked ready after its application was generated',
    )
  })
})
