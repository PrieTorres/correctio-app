import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CORRECTION_SOURCE, CORRECTION_STATUS, type AnswerSheet } from '@correctio/domain'
import type { Express } from 'express'
import type { Kysely } from 'kysely'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase, DATABASE_TEST_URL, type TestDatabase } from '../../__tests__/test-database'
import { createApp } from '../../app'
import { loadEnv } from '../../config/env'
import { createLocalFileStorage, type FileStorage } from '../../lib/file-storage'
import { createLogger } from '../../lib/logger'
import { readPhotoHere } from '../../lib/sheet-reading/photo-reader'
import type { VerifyToken } from '../../middlewares/require-auth'
import type { Database } from '../../models/tables'

const verifyToken: VerifyToken = (token) => Promise.resolve(token === 'token-ana' ? { teacherId: 'ana' } : null)
const RELAXED = { windowMs: 60_000, limit: 10_000 }
const ONE_VERSION = { versions: [{ shuffleQuestions: false, shuffleAlternatives: false }], withStudentIdentification: true }
const PHOTO = Buffer.from('the photo of a sheet, with the handwriting and the name')

const student = (id: string, fullName: string, registration: string) => ({ id, classId: 'class-ana', fullName, registration, email: null, userId: null })

/**
 * RF38 and LGPD art. 18: the photo of a sheet shows the student's handwriting
 * and may carry the name, so anonymizing the student erases it. Three students
 * each have a printed sheet with a photo; Caio's sheet was corrected as Bia's,
 * as when two students swap seats, so that photo is Bia's too.
 */
describe.runIf(DATABASE_TEST_URL !== undefined)('anonymizing a student erases the photos of their sheets (real MySQL)', () => {
  let database: TestDatabase
  let db: Kysely<Database>
  let folder: string
  let fileStorage: FileStorage
  let app: Express
  const keyOf = (studentId: string) => `answer-sheets/app-ana/photo-of-${studentId}.png`

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
      .values([student('s-bia', 'Bia Souza', '2026001'), student('s-caio', 'Caio Lima', '2026002'), student('s-dani', 'Dani Reis', '2026003')])
      .execute()
    await db
      .insertInto('questions')
      .values({ id: 'q-1', teacherId: 'ana', type: 'objetiva', statement: 'Quanto é 2 + 2?', correctAlternativeId: 'q-1-b', maxScore: null, deletedAt: null, allowShuffleAlternatives: true })
      .execute()
    await db
      .insertInto('question_alternatives')
      .values(['3', '4'].map((text, position) => ({ questionId: 'q-1', id: `q-1-${'ab'[position]}`, text, position })))
      .execute()
    await db
      .insertInto('exams')
      .values({ id: 'exam-ana', teacherId: 'ana', title: 'Prova 1', description: '', status: 'draft', defaultShuffleQuestions: false, defaultShuffleAlternatives: false })
      .execute()
    await db.insertInto('exam_questions').values({ examId: 'exam-ana', questionId: 'q-1', order: 0, score: 10, allowShuffleAlternatives: true }).execute()
    await db
      .insertInto('applications')
      .values({ id: 'app-ana', examId: 'exam-ana', classId: 'class-ana', teacherId: 'ana', status: 'draft', pdfUrl: null, gradesReleased: false, date: new Date('2026-11-27T12:00:00.000Z') })
      .execute()

    folder = await mkdtemp(join(tmpdir(), 'correctio-anonymize-'))
    fileStorage = createLocalFileStorage(folder)
    app = createApp({
      env: loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }),
      logger: createLogger('silent'),
      db,
      verifyToken,
      fileStorage,
      readPhoto: readPhotoHere,
      rateLimits: { read: RELAXED, write: RELAXED, expensive: RELAXED },
    })

    const generated = await request(app).post('/applications/app-ana/generate-pdf').set('Authorization', 'Bearer token-ana').send(ONE_VERSION)
    expect(generated.status).toBe(200)
    const sheets = (generated.body as { sheets: AnswerSheet[] }).sheets
    const sheetOf = (studentId: string) => sheets.find((sheet) => sheet.studentId === studentId) as AnswerSheet

    for (const studentId of ['s-bia', 's-caio', 's-dani']) {
      await fileStorage.save(keyOf(studentId), PHOTO, 'image/png')
      await db
        .insertInto('sheet_images')
        .values({
          id: `photo-of-${studentId}`,
          applicationId: 'app-ana',
          teacherId: 'ana',
          storageKey: keyOf(studentId),
          contentType: 'image/png',
          byteSize: PHOTO.length,
          status: 'READ',
          answerSheetId: sheetOf(studentId).id,
        })
        .execute()
    }
    const caioSheet = sheetOf('s-caio')
    await db
      .insertInto('corrections')
      .values({
        id: randomUUID(),
        examVersionId: caioSheet.examVersionId,
        studentId: 's-bia',
        reportedStudentName: null,
        reportedStudentRegistration: null,
        totalScore: 0,
        notes: null,
        confirmedAt: new Date(),
        correctedBy: 'ana',
        isAutomaticallyAssigned: false,
        clientCorrectionId: randomUUID(),
        syncStatus: 'synced',
        answerSheetId: caioSheet.id,
        source: CORRECTION_SOURCE.IMAGE_UPLOAD,
        status: CORRECTION_STATUS.DONE,
        imageUrl: null,
      })
      .execute()

    const anonymized = await request(app).post('/classes/class-ana/students/s-bia/anonymize').set('Authorization', 'Bearer token-ana')
    expect(anonymized.status).toBe(204)
  }, 60_000)

  afterAll(async () => {
    await database.drop()
    await rm(folder, { recursive: true, force: true })
  })

  it('erases the photo of the sheet printed for the student', async () => {
    expect(await fileStorage.read(keyOf('s-bia'))).toBeNull()
  })

  /** A correction that gives a sheet to the student makes its photo the student's handwriting. */
  it('erases the photo of a sheet corrected as the student', async () => {
    expect(await fileStorage.read(keyOf('s-caio'))).toBeNull()
  })

  it('keeps the photo of every other student', async () => {
    expect(await fileStorage.read(keyOf('s-dani'))).toEqual(PHOTO)
  })

  /** The row holds no personal data and keeps the reading's history; only the file, which shows the handwriting, goes. */
  it('keeps the record of the photo, whose file no longer opens', async () => {
    const rows = await db.selectFrom('sheet_images').select('id').where('id', '=', 'photo-of-s-bia').execute()
    expect(rows).toHaveLength(1)

    const image = await request(app).get('/applications/app-ana/sheet-images/photo-of-s-bia').set('Authorization', 'Bearer token-ana')
    expect(image.status).toBe(404)
  })

  /** A request that failed halfway is finished by the next one, which finds the student already anonymized. */
  it('answers a second request on the anonymized student without error', async () => {
    const again = await request(app).post('/classes/class-ana/students/s-bia/anonymize').set('Authorization', 'Bearer token-ana')

    expect(again.status).toBe(204)
  })
})
