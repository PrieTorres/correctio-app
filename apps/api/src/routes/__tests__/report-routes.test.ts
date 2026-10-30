import { randomBytes, randomUUID } from 'node:crypto'
import type { ApplicationReport, ApplicationStatus, ConsolidatedReportRow, DashboardSummary, ExamVersionLayout } from '@correctio/domain'
import type { Express } from 'express'
import type { Kysely } from 'kysely'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, DATABASE_TEST_URL, type TestDatabase } from '../../__tests__/test-database'
import { createApp } from '../../app'
import { loadEnv } from '../../config/env'
import { createLogger } from '../../lib/logger'
import type { VerifyToken } from '../../middlewares/require-auth'
import type { Database } from '../../models/tables'

const TOKENS: Readonly<Record<string, string>> = { 'token-ana': 'ana', 'token-bia': 'bia' }
const verifyToken: VerifyToken = (token) => {
  const teacherId = TOKENS[token]
  return Promise.resolve(teacherId === undefined ? null : { teacherId })
}

/** Generous budgets: these tests are about the routes, and `rate-limit.test.ts` covers the limits. */
const RELAXED = { windowMs: 60_000, limit: 10_000 }

const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent' })

const LAYOUT: ExamVersionLayout = { questionOrder: ['q-limits', 'q-old', 'q-essay'], alternativeOrder: [] }

const teacher = (id: string) => ({ id, role: 'professor' as const, fullName: id, email: `${id}@exemplo.edu.br`, passwordHash: 'x' })
const classOf = (id: string, teacherId: string, status: 'active' | 'archived' = 'active') => ({
  id,
  teacherId,
  name: `Turma ${id}`,
  subject: 'Matemática',
  term: '2026/2',
  status,
  inviteCode: id.toUpperCase().slice(-8),
})
const exam = (id: string, teacherId: string, status: 'draft' | 'ready' | 'closed') => ({
  id,
  teacherId,
  title: `Prova ${id}`,
  description: '',
  status,
  defaultShuffleQuestions: false,
  defaultShuffleAlternatives: false,
})

/** Right on `q-limits` and `q-old`, 4 on the essay: the whole 10 points. */
const FULL_MARKS = {
  answers: [
    { questionId: 'q-limits', selectedAlternativeId: 'lim-b' },
    { questionId: 'q-old', selectedAlternativeId: 'old-a' },
  ],
  discursiveScores: [{ questionId: 'q-essay', score: 4 }],
  finalize: true,
}

/** Wrong on `q-limits`, right on `q-old`, the essay left without a mark: stays in progress (RF47). */
const UNFINISHED = {
  answers: [
    { questionId: 'q-limits', selectedAlternativeId: 'lim-a' },
    { questionId: 'q-old', selectedAlternativeId: 'old-a' },
  ],
  discursiveScores: [],
  finalize: true,
}

describe.runIf(DATABASE_TEST_URL !== undefined)('report routes (real MySQL)', () => {
  let database: TestDatabase
  let db: Kysely<Database>
  let app: Express

  /**
   * Ana's exam `exam-applied` has three questions: `q-limits` (worth 3, tag
   * "Limites"), `q-old` (worth 3, tag "Derivadas", deleted from the bank after
   * printing) and the open-ended `q-essay` (worth 4). The exam is archived
   * after being applied, and so is `class-old`, so the reports must still name
   * both.
   */
  beforeAll(async () => {
    database = await createTestDatabase()
    db = database.db
    await db.insertInto('users').values([teacher('ana'), teacher('bia')]).execute()
    await db.insertInto('classes').values([classOf('class-ana', 'ana'), classOf('class-old', 'ana', 'archived'), classOf('class-bia', 'bia')]).execute()
    await db
      .insertInto('students')
      .values([
        { id: 'student-1', classId: 'class-ana', fullName: 'Ana Lima', registration: '2026001', email: null, userId: null },
        { id: 'student-2', classId: 'class-ana', fullName: 'Bruno Melo', registration: '2026002', email: null, userId: null, removedAt: new Date('2026-10-20T12:00:00.000Z') },
      ])
      .execute()
    await db
      .insertInto('questions')
      .values([
        { id: 'q-limits', teacherId: 'ana', type: 'objetiva', statement: 'Quanto vale o limite?', correctAlternativeId: 'lim-b', maxScore: null, allowShuffleAlternatives: true },
        { id: 'q-old', teacherId: 'ana', type: 'objetiva', statement: 'Questão antiga', correctAlternativeId: 'old-a', maxScore: null, allowShuffleAlternatives: true, deletedAt: new Date('2026-10-10T12:00:00.000Z') },
        { id: 'q-essay', teacherId: 'ana', type: 'discursiva', statement: 'Explique', correctAlternativeId: null, maxScore: 4, allowShuffleAlternatives: true },
      ])
      .execute()
    await db
      .insertInto('question_alternatives')
      .values([
        { questionId: 'q-limits', id: 'lim-a', text: '0', position: 0 },
        { questionId: 'q-limits', id: 'lim-b', text: '1', position: 1 },
        { questionId: 'q-old', id: 'old-a', text: 'sim', position: 0 },
        { questionId: 'q-old', id: 'old-b', text: 'não', position: 1 },
      ])
      .execute()
    await db
      .insertInto('question_tags')
      .values([
        { questionId: 'q-limits', tag: 'Limites' },
        { questionId: 'q-old', tag: 'Derivadas' },
      ])
      .execute()
    await db.insertInto('exams').values([exam('exam-applied', 'ana', 'closed'), exam('exam-ready', 'ana', 'ready'), exam('exam-bia', 'bia', 'ready')]).execute()
    await db
      .insertInto('exam_questions')
      .values([
        { examId: 'exam-applied', questionId: 'q-essay', order: 2, score: 4, allowShuffleAlternatives: true },
        { examId: 'exam-applied', questionId: 'q-limits', order: 0, score: 3, allowShuffleAlternatives: true },
        { examId: 'exam-applied', questionId: 'q-old', order: 1, score: 3, allowShuffleAlternatives: true },
      ])
      .execute()
    app = createApp({ env, logger: createLogger('silent'), db, verifyToken, rateLimits: { read: RELAXED, write: RELAXED } })
  })

  afterAll(async () => {
    await database.drop()
  })

  /** Children first, so no foreign key blocks the delete. */
  beforeEach(async () => {
    await db.deleteFrom('correction_objective_results').execute()
    await db.deleteFrom('correction_discursive_scores').execute()
    await db.deleteFrom('corrections').execute()
    await db.deleteFrom('answer_sheets').execute()
    await db.deleteFrom('exam_versions').execute()
    await db.deleteFrom('applications').execute()
  })

  function asTeacher(token: string) {
    const authorization = { Authorization: `Bearer ${token}` }
    return {
      get: (path: string) => request(app).get(path).set(authorization),
      post: (path: string, body?: object) => request(app).post(path).set(authorization).send(body),
    }
  }
  const ana = () => asTeacher('token-ana')
  const bia = () => asTeacher('token-bia')

  interface Sitting {
    teacherId?: string
    classId?: string
    examId?: string
    date?: string
    status?: ApplicationStatus
  }

  /** An application with one version and three sheets: one printed for `student-1`, one for `student-2`, one without a name. */
  async function application({ teacherId = 'ana', classId = 'class-ana', examId = 'exam-applied', date = '2026-10-05T12:00:00.000Z', status = 'generated' }: Sitting = {}) {
    const applicationId = randomUUID()
    await db.insertInto('applications').values({ id: applicationId, examId, classId, teacherId, status, pdfUrl: null, date: new Date(date), gradesReleased: false }).execute()
    const versionId = randomUUID()
    await db
      .insertInto('exam_versions')
      .values({
        id: versionId,
        applicationId,
        versionNumber: 1,
        shuffleQuestions: false,
        shuffleAlternatives: false,
        withStudentIdentification: true,
        layout: JSON.stringify(LAYOUT),
        answerKeyPublished: false,
        publicCode: `PUB-${versionId}`,
        qrCodePayload: `QR-${versionId}`,
      })
      .execute()
    const sheet = (sheetNumber: number, studentId: string | null) => ({
      id: randomUUID(),
      applicationId,
      examVersionId: versionId,
      sheetNumber,
      studentId,
      code: randomBytes(13).toString('hex').toUpperCase(),
    })
    const sheets = [sheet(1, 'student-1'), sheet(2, 'student-2'), sheet(3, null)] as const
    await db.insertInto('answer_sheets').values([...sheets]).execute()
    return { applicationId, first: sheets[0].id, second: sheets[1].id, blank: sheets[2].id }
  }

  /** Writes the correction through its own route, so the grade is the server's, as in production. */
  async function correct(applicationId: string, answerSheetId: string, review: object): Promise<void> {
    const response = await ana().post(`/applications/${applicationId}/corrections`, { ...review, answerSheetId })
    expect(response.status).toBe(201)
  }

  describe('GET /dashboard', () => {
    it('counts only what is active and the teacher’s own', async () => {
      await application()
      await application({ status: 'closed' })
      await application({ teacherId: 'bia', classId: 'class-bia', examId: 'exam-bia' })

      const response = await ana().get('/dashboard')

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({ classes: 1, questions: 2, exams: 1, applications: 1 })
    })

    /** The panel's number (#93): in progress (RF48) or without a student (RF31), each correction once. */
    it('counts the pending corrections once each, of active applications only', async () => {
      const sitting = await application()
      await correct(sitting.applicationId, sitting.first, UNFINISHED)
      await correct(sitting.applicationId, sitting.second, FULL_MARKS)
      await correct(sitting.applicationId, sitting.blank, UNFINISHED)
      const done = await application({ date: '2026-10-06T12:00:00.000Z' })
      await correct(done.applicationId, done.blank, FULL_MARKS)
      const archived = await application({ date: '2026-10-07T12:00:00.000Z' })
      await correct(archived.applicationId, archived.first, UNFINISHED)
      await db.updateTable('applications').set({ status: 'closed' }).where('id', '=', archived.applicationId).execute()

      expect((await ana().get('/dashboard')).body).toMatchObject({ pendingCorrections: 3 })
      expect((await bia().get('/dashboard')).body).toMatchObject({ pendingCorrections: 0 })
    })

    /** Sorted on the server: the browser no longer sorts a page of 1000 to find the latest five. */
    it('lists the five most recent applications by day, named by the archived exam and class too', async () => {
      const days = ['2026-09-01', '2026-11-20', '2026-10-01', '2026-12-05', '2026-10-15', '2026-11-01']
      const ids = new Map<string, string>()
      for (const day of days) ids.set(day, (await application({ date: `${day}T12:00:00.000Z`, classId: 'class-old', status: 'draft' })).applicationId)
      await application({ date: '2027-01-01T12:00:00.000Z', status: 'closed' })

      const { recent } = (await ana().get('/dashboard')).body as DashboardSummary

      expect(recent.map((item) => item.id)).toEqual(['2026-12-05', '2026-11-20', '2026-11-01', '2026-10-15', '2026-10-01'].map((day) => ids.get(day)))
      expect(recent[0]).toEqual({ id: ids.get('2026-12-05'), title: 'Prova exam-applied', detail: 'Turma class-old', date: '2026-12-05T12:00:00.000Z' })
    })

    it('offers to grade only the applications with printed sheets, the most recent first', async () => {
      const older = await application({ date: '2026-10-01T12:00:00.000Z' })
      const newer = await application({ date: '2026-10-20T12:00:00.000Z' })
      await application({ date: '2026-10-25T12:00:00.000Z', status: 'draft' })

      const { gradable } = (await ana().get('/dashboard')).body as DashboardSummary

      expect(gradable.map((item) => item.id)).toEqual([newer.applicationId, older.applicationId])
    })
  })

  describe('GET /applications/:id/report', () => {
    const reportOf = (applicationId: string) => `/applications/${applicationId}/report`

    it('answers zeros and the questions of the exam when nothing was corrected yet', async () => {
      const { applicationId } = await application()

      const response = await ana().get(reportOf(applicationId))

      expect(response.status).toBe(200)
      const report = response.body as ApplicationReport
      expect(report).toMatchObject({
        applicationId,
        examTitle: 'Prova exam-applied',
        className: 'Turma class-ana',
        maximumScore: 10,
        sheets: 3,
        inProgress: 0,
        summary: { count: 0, mean: 0, median: 0, standardDeviation: 0, lowest: 0, highest: 0 },
        students: [],
        tags: [],
      })
      expect(report.questions.map((question) => question.statement)).toEqual(['Quanto vale o limite?', 'Questão antiga', 'Explique'])
    })

    /** Requirements, section 5: the grade counts once every open-ended question has a mark. */
    it('counts only the finished corrections, and the ones in progress apart', async () => {
      const { applicationId, first, second, blank } = await application()
      await correct(applicationId, first, FULL_MARKS)
      await correct(applicationId, blank, { ...FULL_MARKS, discursiveScores: [{ questionId: 'q-essay', score: 1 }] })
      await correct(applicationId, second, UNFINISHED)

      const report = (await ana().get(reportOf(applicationId))).body as ApplicationReport

      expect(report.inProgress).toBe(1)
      expect(report.summary).toMatchObject({ count: 2, mean: 8.5, lowest: 7, highest: 10 })
      expect(report.students).toEqual([
        { correctionId: expect.any(String), name: 'Ana Lima', registration: '2026001', versionNumber: 1, totalScore: 10, questionScores: [3, 3, 4] },
        { correctionId: expect.any(String), name: 'Folha 3', registration: '', versionNumber: 1, totalScore: 7, questionScores: [3, 3, 1] },
      ])
      expect(report.questions[0]).toMatchObject({ number: 1, accuracy: { answered: 2, correct: 2, percentage: 100, mostMarkedLetter: 'B' } })
    })

    /** The tag of the question deleted after printing still counts, and the removed student keeps the name (#161). */
    it('keeps the deleted question and the removed student in the report', async () => {
      const { applicationId, second } = await application()
      await correct(applicationId, second, { ...FULL_MARKS, answers: [{ questionId: 'q-limits', selectedAlternativeId: 'lim-b' }, { questionId: 'q-old', selectedAlternativeId: 'old-b' }] })

      const report = (await ana().get(reportOf(applicationId))).body as ApplicationReport

      expect(report.tags).toEqual([
        { tag: 'Derivadas', answered: 1, correct: 0, percentage: 0 },
        { tag: 'Limites', answered: 1, correct: 1, percentage: 100 },
      ])
      expect(report.students[0]).toMatchObject({ name: 'Bruno Melo', registration: '2026002' })
    })

    it('answers 404 for another teacher’s application, never 403', async () => {
      const { applicationId } = await application()

      const response = await bia().get(reportOf(applicationId))

      expect(response.status).toBe(404)
      expect(response.body.code).toBe('not-found')
      expect((await ana().get(reportOf(randomUUID()))).status).toBe(404)
    })
  })

  describe('GET /reports/consolidated', () => {
    it('lists the applications with a grade, the most recent first, with what the filters of P19 read', async () => {
      const older = await application({ date: '2026-09-10T12:00:00.000Z' })
      await correct(older.applicationId, older.first, FULL_MARKS)
      const newer = await application({ classId: 'class-old', date: '2026-10-10T12:00:00.000Z' })
      await correct(newer.applicationId, newer.first, FULL_MARKS)
      await correct(newer.applicationId, newer.blank, { ...FULL_MARKS, discursiveScores: [{ questionId: 'q-essay', score: 0 }] })
      await correct(newer.applicationId, newer.second, UNFINISHED)
      const unfinished = await application({ date: '2026-11-10T12:00:00.000Z' })
      await correct(unfinished.applicationId, unfinished.first, UNFINISHED)
      await application({ date: '2026-12-10T12:00:00.000Z' })

      const response = await ana().get('/reports/consolidated')

      expect(response.status).toBe(200)
      expect(response.body as ConsolidatedReportRow[]).toEqual([
        {
          applicationId: newer.applicationId,
          examTitle: 'Prova exam-applied',
          classId: 'class-old',
          className: 'Turma class-old',
          subject: 'Matemática',
          term: '2026/2',
          date: '2026-10-10T12:00:00.000Z',
          summary: { count: 2, mean: 8, median: 8, standardDeviation: 2, lowest: 6, highest: 10 },
        },
        expect.objectContaining({ applicationId: older.applicationId, summary: expect.objectContaining({ count: 1, mean: 10 }) }),
      ])
    })

    it('shows nothing of another teacher', async () => {
      const sitting = await application()
      await correct(sitting.applicationId, sitting.first, FULL_MARKS)

      expect((await bia().get('/reports/consolidated')).body).toEqual([])
    })
  })
})
