import type { PublicLookup } from '@correctio/domain'
import type { Express } from 'express'
import type { Kysely } from 'kysely'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, DATABASE_TEST_URL, type TestDatabase } from '../../__tests__/test-database'
import { createApp } from '../../app'
import { loadEnv } from '../../config/env'
import { createLogger } from '../../lib/logger'
import type { Database } from '../../models/tables'

const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23'
const PUBLIC_LIMIT = 5

/**
 * One application printed in a single version: an open-ended question first,
 * then two multiple-choice ones in the opposite order of their ids, so the
 * answer key can only be right if it follows the printed layout.
 */
async function seedApplication(db: Kysely<Database>) {
  await db.insertInto('users').values({ id: 'ana', role: 'professor', fullName: 'Ana', email: 'ana@exemplo.edu.br', passwordHash: 'x' }).execute()
  await db
    .insertInto('classes')
    .values({ id: 'class-1', teacherId: 'ana', name: 'Cálculo I', subject: 'Matemática', term: '2026/2', status: 'active', inviteCode: 'INVITE01' })
    .execute()
  await db
    .insertInto('students')
    .values({ id: 'student-1', classId: 'class-1', fullName: 'Bruna Lima', registration: '2026001', email: null, userId: null })
    .execute()
  await db
    .insertInto('questions')
    .values([
      { id: 'q-open', teacherId: 'ana', type: 'discursiva', statement: 'Explique', correctAlternativeId: null, maxScore: 4, allowShuffleAlternatives: true },
      { id: 'q-a', teacherId: 'ana', type: 'objetiva', statement: 'Primeira', correctAlternativeId: 'q-a-1', maxScore: null, allowShuffleAlternatives: true },
      { id: 'q-b', teacherId: 'ana', type: 'objetiva', statement: 'Segunda', correctAlternativeId: 'q-b-2', maxScore: null, allowShuffleAlternatives: true },
    ])
    .execute()
  await db.insertInto('exams').values({ id: 'exam-1', teacherId: 'ana', title: 'Prova 1', status: 'ready', description: '', defaultShuffleQuestions: true, defaultShuffleAlternatives: true }).execute()
  await db
    .insertInto('applications')
    .values({ id: 'app-1', examId: 'exam-1', classId: 'class-1', teacherId: 'ana', status: 'generated', pdfUrl: null, date: new Date('2026-10-20T13:00:00.000Z'), gradesReleased: false })
    .execute()
  await db
    .insertInto('exam_versions')
    .values({
      id: 'version-1',
      applicationId: 'app-1',
      versionNumber: 2,
      shuffleQuestions: true,
      shuffleAlternatives: true,
      withStudentIdentification: false,
      layout: JSON.stringify({ questionOrder: ['q-open', 'q-b', 'q-a'], alternativeOrder: [] }),
      answerKeyPublished: false,
      publicCode: 'public-1',
      qrCodePayload: 'payload-1',
    })
    .execute()
  await db.insertInto('answer_sheets').values({ id: 'sheet-1', applicationId: 'app-1', examVersionId: 'version-1', studentId: null, sheetNumber: 37, code: CODE }).execute()
}

async function seedCorrection(db: Kysely<Database>, studentId: string | null) {
  await db
    .insertInto('corrections')
    .values({
      id: 'correction-1',
      examVersionId: 'version-1',
      studentId,
      reportedStudentName: null,
      reportedStudentRegistration: null,
      totalScore: 7.5,
      notes: null,
      confirmedAt: new Date('2026-10-21T10:00:00.000Z'),
      correctedBy: 'ana',
      isAutomaticallyAssigned: false,
      clientCorrectionId: 'client-1',
      syncStatus: 'synced',
      answerSheetId: 'sheet-1',
      source: 'MANUAL',
      status: 'DONE',
      imageUrl: null,
    })
    .execute()
  await db
    .insertInto('correction_objective_results')
    .values([
      { correctionId: 'correction-1', questionId: 'q-a', correct: true, score: 2.5, selectedAlternativeId: 'q-a-1' },
      { correctionId: 'correction-1', questionId: 'q-b', correct: false, score: 0, selectedAlternativeId: null },
    ])
    .execute()
}

describe.runIf(DATABASE_TEST_URL !== undefined)('public lookup route (real MySQL)', () => {
  let database: TestDatabase
  let db: Kysely<Database>
  let app: Express

  beforeAll(async () => {
    database = await createTestDatabase()
    db = database.db
  })

  afterAll(() => database.drop())

  /** A fresh app per test, so each starts with the whole public budget. */
  beforeEach(async () => {
    await db.deleteFrom('correction_objective_results').execute()
    await db.deleteFrom('corrections').execute()
    await db.deleteFrom('answer_sheets').execute()
    await db.deleteFrom('exam_versions').execute()
    await db.deleteFrom('applications').execute()
    await db.deleteFrom('exams').execute()
    await db.deleteFrom('questions').execute()
    await db.deleteFrom('students').execute()
    await db.deleteFrom('classes').execute()
    await db.deleteFrom('users').execute()
    await seedApplication(db)

    app = createApp({
      env: loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }),
      logger: createLogger('silent'),
      db,
      rateLimits: { public: { windowMs: 60_000, limit: PUBLIC_LIMIT } },
    })
  })

  const lookup = async (code: string): Promise<PublicLookup> => {
    const response = await request(app).get(`/public/sheets/${code}`)
    expect(response.status).toBe(200)
    return response.body as PublicLookup
  }

  const release = (changes: { answerKeyPublished?: boolean; withStudentIdentification?: boolean; gradesReleased?: boolean }) =>
    Promise.all([
      db
        .updateTable('exam_versions')
        .set({
          answerKeyPublished: changes.answerKeyPublished ?? false,
          withStudentIdentification: changes.withStudentIdentification ?? false,
        })
        .execute(),
      db
        .updateTable('applications')
        .set({ gradesReleased: changes.gradesReleased ?? false })
        .execute(),
    ])

  it('answers without a token, and an unknown code as an answer rather than an error', async () => {
    await expect(lookup('NOPE')).resolves.toEqual({ status: 'INVALID_CODE' })
  })

  it('refuses a code longer than any printed one without reading the database', async () => {
    await expect(lookup('A'.repeat(33))).resolves.toEqual({ status: 'INVALID_CODE' })
  })

  it('shows only the header, identified by sheet and version, before anything is released', async () => {
    await expect(lookup(CODE)).resolves.toEqual({
      status: 'NOTHING_RELEASED',
      header: {
        examTitle: 'Prova 1',
        subject: 'Matemática',
        className: 'Cálculo I',
        date: '2026-10-20T13:00:00.000Z',
        identity: { type: 'SHEET', sheetNumber: 37, versionNumber: 2 },
      },
    })
  })

  it('lists the answer key in the printed order, leaving out open-ended questions', async () => {
    await release({ answerKeyPublished: true })

    const result = await lookup(CODE)

    expect(result.status).toBe('ANSWER_KEY_ONLY')
    expect(result.status === 'ANSWER_KEY_ONLY' && result.answerKey).toEqual([
      { questionId: 'q-b', correctAlternativeId: 'q-b-2' },
      { questionId: 'q-a', correctAlternativeId: 'q-a-1' },
    ])
  })

  it('keeps the score hidden while grades are not released, even with a correction', async () => {
    await seedCorrection(db, 'student-1')
    await release({ answerKeyPublished: true })

    await expect(lookup(CODE)).resolves.toMatchObject({ status: 'ANSWER_KEY_ONLY' })
  })

  it('adds the score and the student name once grades are released on an identified version', async () => {
    await seedCorrection(db, 'student-1')
    await release({ answerKeyPublished: true, withStudentIdentification: true, gradesReleased: true })

    await expect(lookup(CODE)).resolves.toMatchObject({
      status: 'ANSWER_KEY_AND_SCORE',
      header: { identity: { type: 'STUDENT', fullName: 'Bruna Lima' } },
      totalScore: 7.5,
      objectiveResults: [
        { questionId: 'q-a', correct: true, score: 2.5, selectedAlternativeId: 'q-a-1' },
        { questionId: 'q-b', correct: false, score: 0 },
      ],
    })
  })

  it('does not name a student removed from the class', async () => {
    await seedCorrection(db, 'student-1')
    await db.updateTable('students').set({ removedAt: new Date() }).execute()
    await release({ answerKeyPublished: true, withStudentIdentification: true, gradesReleased: true })

    await expect(lookup(CODE)).resolves.toMatchObject({ header: { identity: { type: 'SHEET', sheetNumber: 37 } } })
  })

  it('keeps a question deleted after printing in the answer key', async () => {
    await db.updateTable('questions').set({ deletedAt: new Date() }).where('id', '=', 'q-a').execute()
    await release({ answerKeyPublished: true })

    await expect(lookup(CODE)).resolves.toMatchObject({ answerKey: [{ questionId: 'q-b' }, { questionId: 'q-a' }] })
  })

  it('never answers the registration of the student', async () => {
    await seedCorrection(db, 'student-1')
    await release({ answerKeyPublished: true, withStudentIdentification: true, gradesReleased: true })

    const response = await request(app).get(`/public/sheets/${CODE}`)

    expect(JSON.stringify(response.body)).not.toContain('2026001')
  })

  it('asks search engines not to index the answer, and browsers not to keep it', async () => {
    const response = await request(app).get(`/public/sheets/${CODE}`)

    expect(response.headers['x-robots-tag']).toBe('noindex, nofollow')
    expect(response.headers['cache-control']).toContain('no-store')
  })

  it('spends the public budget on every request, found or not', async () => {
    for (let attempt = 0; attempt < PUBLIC_LIMIT; attempt += 1) {
      await request(app).get(`/public/sheets/GUESS${attempt}`).expect(200)
    }

    const response = await request(app).get(`/public/sheets/${CODE}`)

    expect(response.status).toBe(429)
    expect(response.headers['retry-after']).toBe('60')
  })
})
