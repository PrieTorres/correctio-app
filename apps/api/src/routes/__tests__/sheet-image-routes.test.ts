import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AnswerSheet, ExamVersion, SheetImageUpload } from '@correctio/domain'
import { photographCard, type PrintedCard } from '@correctio/sheet-reader/testing'
import type { Express } from 'express'
import type { Kysely } from 'kysely'
import sharp from 'sharp'
import request, { type Response } from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, DATABASE_TEST_URL, type TestDatabase } from '../../__tests__/test-database'
import { createApp } from '../../app'
import { loadEnv } from '../../config/env'
import { createLocalFileStorage } from '../../lib/file-storage'
import { createLogger } from '../../lib/logger'
import { readPhotoHere } from '../../lib/sheet-reading/photo-reader'
import type { VerifyToken } from '../../middlewares/require-auth'
import type { Database } from '../../models/tables'

const TOKENS: Readonly<Record<string, string>> = { 'token-ana': 'ana', 'token-bia': 'bia' }
const verifyToken: VerifyToken = (token) => {
  const teacherId = TOKENS[token]
  return Promise.resolve(teacherId === undefined ? null : { teacherId })
}

const RELAXED = { windowMs: 60_000, limit: 10_000 }
const ONE_VERSION = { versions: [{ shuffleQuestions: false, shuffleAlternatives: false }], withStudentIdentification: true }

const teacher = (id: string) => ({ id, role: 'professor' as const, fullName: id, email: `${id}@exemplo.edu.br`, passwordHash: 'x' })

/** A PNG of the pixels, as a phone or a scanner would hand them over. */
async function png({ data, width, height }: { data: Uint8ClampedArray; width: number; height: number }): Promise<Buffer> {
  return sharp(Buffer.from(data), { raw: { width, height, channels: 4 } }).png().toBuffer()
}

/** The bubbles of each printed row: as many as the question has alternatives, none for an open-ended one. */
function bubblesOf(version: ExamVersion): number[] {
  const alternatives = new Map(version.layout.alternativeOrder.map((entry) => [entry.questionId, entry.printedOrder.length]))
  return version.layout.questionOrder.map((questionId) => alternatives.get(questionId) ?? 0)
}

/**
 * The photo routes of #47 against a real MySQL and a real reader: a sheet is
 * printed by the generation route, photographed synthetically with its own QR
 * Code and bubbles, and sent back. The photos are drawn once, since each takes
 * a moment to draw pixel by pixel.
 */
describe.runIf(DATABASE_TEST_URL !== undefined)('photos of the sheets (real MySQL)', () => {
  let database: TestDatabase
  let db: Kysely<Database>
  let folder: string
  let app: Express
  let sheet: AnswerSheet
  let version: ExamVersion
  let readable: Buffer
  let foreign: Buffer
  let unreadableMarks: Buffer

  const as = (token: string) => ({ Authorization: `Bearer ${token}` })
  const upload = (photo: Buffer, applicationId = 'app-ana', token = 'token-ana', type = 'image/png') =>
    request(app).post(`/applications/${applicationId}/sheet-images`).set(as(token)).set('Content-Type', type).send(photo)
  const uploaded = (response: Response) => response.body as SheetImageUpload

  beforeAll(async () => {
    database = await createTestDatabase()
    db = database.db
    await db.insertInto('users').values([teacher('ana'), teacher('bia')]).execute()
    await db
      .insertInto('classes')
      .values({ id: 'class-ana', teacherId: 'ana', name: 'Cálculo I', subject: 'Matemática', term: '2026/2', status: 'active', inviteCode: 'CALCULO1' })
      .execute()
    await db
      .insertInto('students')
      .values({ id: 's-ana', classId: 'class-ana', fullName: 'Ana Beatriz', registration: '2026001', email: null, userId: null })
      .execute()
    await db
      .insertInto('questions')
      .values([
        { id: 'q-1', teacherId: 'ana', type: 'objetiva', statement: 'Quanto é 2 + 2?', correctAlternativeId: 'q-1-b', maxScore: null, deletedAt: null, allowShuffleAlternatives: true },
        { id: 'q-2', teacherId: 'ana', type: 'discursiva', statement: 'Explique.', correctAlternativeId: null, maxScore: 2, deletedAt: null, allowShuffleAlternatives: false },
      ])
      .execute()
    await db
      .insertInto('question_alternatives')
      .values(['3', '4', '5', '6'].map((text, position) => ({ questionId: 'q-1', id: `q-1-${'abcd'[position]}`, text, position })))
      .execute()
    await db
      .insertInto('exams')
      .values({ id: 'exam-ana', teacherId: 'ana', title: 'Prova 1', description: '', status: 'draft', defaultShuffleQuestions: false, defaultShuffleAlternatives: false })
      .execute()
    await db
      .insertInto('exam_questions')
      .values([
        { examId: 'exam-ana', questionId: 'q-1', order: 0, score: 5, allowShuffleAlternatives: true },
        { examId: 'exam-ana', questionId: 'q-2', order: 1, score: 2, allowShuffleAlternatives: false },
      ])
      .execute()
    const sitting = { examId: 'exam-ana', classId: 'class-ana', teacherId: 'ana', status: 'draft' as const, pdfUrl: null, gradesReleased: false }
    await db
      .insertInto('applications')
      .values([
        { id: 'app-ana', ...sitting, date: new Date('2026-10-05T12:00:00.000Z') },
        { id: 'app-draft', ...sitting, date: new Date('2026-10-06T12:00:00.000Z') },
      ])
      .execute()

    folder = await mkdtemp(join(tmpdir(), 'correctio-photos-'))
    app = createApp({
      env: loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }),
      logger: createLogger('silent'),
      db,
      verifyToken,
      fileStorage: createLocalFileStorage(folder),
      readPhoto: readPhotoHere,
      rateLimits: { read: RELAXED, write: RELAXED, expensive: RELAXED },
    })

    const generated = await request(app).post('/applications/app-ana/generate-pdf').set(as('token-ana')).send(ONE_VERSION)
    expect(generated.status).toBe(200)
    const paper = generated.body as { versions: ExamVersion[]; sheets: AnswerSheet[] }
    ;[sheet] = paper.sheets as [AnswerSheet]
    ;[version] = paper.versions as [ExamVersion]

    const card: PrintedCard = { qrText: `https://correctio-app.web.app/r/${sheet.code}`, bubbles: bubblesOf(version), marks: { 0: [1] } }
    readable = await png(photographCard(card))
    foreign = await png(photographCard({ ...card, qrText: 'https://correctio-app.web.app/r/ABCDEFGHJKLMNPQRSTUVWXYZ27' }))
    unreadableMarks = await png(photographCard({ ...card, coveredMarker: 'bottomRight' }))
  }, 120_000)

  afterAll(async () => {
    await database.drop()
    await rm(folder, { recursive: true, force: true })
  })

  beforeEach(async () => {
    await db.deleteFrom('correction_objective_results').execute()
    await db.deleteFrom('correction_discursive_scores').execute()
    await db.deleteFrom('corrections').execute()
    await db.deleteFrom('activity_logs').execute()
    await db.deleteFrom('sheet_images').execute()
  })

  it('reads the photo and answers which sheet it is and what was marked, without grading anything', async () => {
    const response = await upload(readable)

    expect(response.status).toBe(201)
    const markedId = version.layout.alternativeOrder[0]?.printedOrder[1]
    expect(uploaded(response)).toEqual({
      imageId: expect.any(String) as string,
      status: 'READ',
      answerSheetId: sheet.id,
      answers: [{ questionId: 'q-1', selectedAlternativeId: markedId }],
    })
    expect(await db.selectFrom('corrections').select('id').execute()).toEqual([])
  }, 60_000)

  /** RNF16: the photo carries a student's handwriting, so it goes only to the application's teacher. */
  it('keeps the photo and serves it back only to the teacher of the application', async () => {
    const { imageId } = uploaded(await upload(readable))

    const own = await request(app).get(`/applications/app-ana/sheet-images/${imageId}`).set(as('token-ana')).buffer(true)
    expect(own.status).toBe(200)
    expect(own.headers['content-type']).toBe('image/png')
    expect(Buffer.compare(own.body as Buffer, readable)).toBe(0)

    const stored = await db.selectFrom('sheet_images').select(['storageKey', 'byteSize']).where('id', '=', imageId).executeTakeFirstOrThrow()
    expect(stored).toEqual({ storageKey: `answer-sheets/app-ana/${imageId}.png`, byteSize: readable.length })
    expect((await request(app).get(`/applications/app-ana/sheet-images/${imageId}`).set(as('token-bia'))).status).toBe(404)
  }, 60_000)

  it('logs a photo of no sheet of the application, without personal data, and lists it for the upload screen', async () => {
    const { imageId, status } = uploaded(await upload(foreign))

    expect(status).toBe('QR_NOT_RECOGNIZED')
    const failures = await request(app).get('/applications/app-ana/read-failures').set(as('token-ana'))
    expect(failures.body).toEqual([{ imageId, status: 'QR_NOT_RECOGNIZED', createdAt: expect.any(String) as string }])
    const [logged] = await db.selectFrom('activity_logs').select(['type', 'teacherId', 'entityId', 'details']).execute()
    expect(logged).toEqual({ type: 'SHEET_READ_FAILED', teacherId: 'ana', entityId: 'app-ana', details: { imageId, status: 'QR_NOT_RECOGNIZED' } })
  }, 60_000)

  /** The QR Code names the sheet even when a covered corner hides the bubbles, so the review opens on the right sheet. */
  it('names the sheet when the QR Code was read and the marks were not', async () => {
    const reading = uploaded(await upload(unreadableMarks))

    expect(reading).toEqual({ imageId: expect.any(String) as string, status: 'READ_FAILED', answerSheetId: sheet.id })
    const failures = await request(app).get('/applications/app-ana/read-failures').set(as('token-ana'))
    expect(failures.body).toEqual([expect.objectContaining({ status: 'READ_FAILED', answerSheetId: sheet.id })])
  }, 60_000)

  it('refuses a file that is not a photo, whatever type it claims', async () => {
    const response = await upload(Buffer.from('%PDF-1.7 not a photo'), 'app-ana', 'token-ana', 'image/jpeg')

    expect(response.status).toBe(400)
    expect(response.body).toEqual({ code: 'invalid', message: 'Envie a foto em JPG, PNG ou WebP.' })
    expect(await db.selectFrom('sheet_images').select('id').execute()).toEqual([])
  })

  it('refuses a photo above 10 MB and an empty request', async () => {
    const tooLarge = Buffer.alloc(10 * 1024 * 1024 + 1, 0)
    tooLarge.set([0xff, 0xd8, 0xff])

    expect((await upload(tooLarge, 'app-ana', 'token-ana', 'image/jpeg')).body).toEqual({
      code: 'invalid',
      message: 'A foto passou de 10 MB. Tire outra com menos resolução.',
    })
    expect((await upload(Buffer.alloc(0))).body).toEqual({ code: 'invalid', message: 'Envie a foto da folha.' })
  })

  it('refuses photos of an application whose PDF was not generated yet', async () => {
    const response = await upload(readable, 'app-draft')

    expect(response.status).toBe(409)
    expect(response.body.message).toBe('Gere o PDF antes de corrigir as folhas.')
  })

  it('answers 404 to another teacher on every photo route', async () => {
    const { imageId } = uploaded(await upload(readable))

    expect((await upload(readable, 'app-ana', 'token-bia')).status).toBe(404)
    expect((await request(app).get(`/applications/app-ana/sheet-images/${imageId}`).set(as('token-bia'))).status).toBe(404)
    expect((await request(app).get('/applications/app-ana/read-failures').set(as('token-bia'))).status).toBe(404)
  }, 60_000)

  /** RF28: the correction is written only when the teacher confirms the review, and then it keeps the photo it came from. */
  it('confirms a correction from the photo, keeping it as the source', async () => {
    const { imageId } = uploaded(await upload(readable))
    const correction = await request(app)
      .post('/applications/app-ana/corrections')
      .set(as('token-ana'))
      .send({ answerSheetId: sheet.id, answers: [{ questionId: 'q-1', selectedAlternativeId: 'q-1-b' }], discursiveScores: [{ questionId: 'q-2', score: 1 }], finalize: true, imageId })

    expect(correction.status).toBe(201)
    expect(correction.body).toMatchObject({ source: 'IMAGE_UPLOAD', imageUrl: `answer-sheets/app-ana/${imageId}.png`, totalScore: 6, status: 'DONE' })
  }, 60_000)

  it('refuses a correction pointing at a photo that is not of the application', async () => {
    const response = await request(app)
      .post('/applications/app-ana/corrections')
      .set(as('token-ana'))
      .send({ answerSheetId: sheet.id, finalize: false, imageId: 'not-a-photo' })

    expect(response.status).toBe(404)
    expect(response.body.message).toBe('Foto não encontrada.')
  })
})
