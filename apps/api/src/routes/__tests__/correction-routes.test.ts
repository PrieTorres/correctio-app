import { randomBytes, randomUUID } from 'node:crypto'
import type { Correction, ExamVersionLayout } from '@correctio/domain'
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
const classOf = (id: string, teacherId: string) => ({ id, teacherId, name: id, subject: 'Matemática', term: '2026/2', status: 'active' as const, inviteCode: id.toUpperCase().slice(-8) })
const student = (id: string, classId: string) => ({ id, classId, fullName: id, registration: id, email: null, userId: null })
const objective = (id: string, correctAlternativeId: string) => ({
  id,
  teacherId: 'ana',
  type: 'objetiva' as const,
  statement: id,
  correctAlternativeId,
  maxScore: null,
  allowShuffleAlternatives: true,
})

describe.runIf(DATABASE_TEST_URL !== undefined)('correction routes (real MySQL)', () => {
  let database: TestDatabase
  let db: Kysely<Database>
  let app: Express

  /**
   * One exam of three questions: `q-limits` (right answer `lim-b`, worth 3),
   * `q-old` (right answer `old-a`, worth 3, deleted from the bank after the
   * exam was printed) and `q-essay`, open-ended and worth 4.
   */
  beforeAll(async () => {
    database = await createTestDatabase()
    db = database.db
    await db.insertInto('users').values([teacher('ana'), teacher('bia')]).execute()
    await db.insertInto('classes').values([classOf('class-ana', 'ana'), classOf('class-other', 'ana'), classOf('class-bia', 'bia')]).execute()
    await db.insertInto('students').values([student('student-1', 'class-ana'), student('student-2', 'class-ana'), student('student-x', 'class-other')]).execute()
    await db
      .insertInto('questions')
      .values([
        objective('q-limits', 'lim-b'),
        { ...objective('q-old', 'old-a'), deletedAt: new Date('2026-10-10T12:00:00.000Z') },
        { id: 'q-essay', teacherId: 'ana', type: 'discursiva', statement: 'q-essay', correctAlternativeId: null, maxScore: 4, allowShuffleAlternatives: true },
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
      .insertInto('exams')
      .values([
        { id: 'exam-ana', teacherId: 'ana', title: 'Prova', description: '', status: 'ready', defaultShuffleQuestions: false, defaultShuffleAlternatives: false },
        { id: 'exam-bia', teacherId: 'bia', title: 'Prova da Bia', description: '', status: 'ready', defaultShuffleQuestions: false, defaultShuffleAlternatives: false },
      ])
      .execute()
    await db
      .insertInto('exam_questions')
      .values([
        { examId: 'exam-ana', questionId: 'q-limits', order: 0, score: 3, allowShuffleAlternatives: true },
        { examId: 'exam-ana', questionId: 'q-old', order: 1, score: 3, allowShuffleAlternatives: true },
        { examId: 'exam-ana', questionId: 'q-essay', order: 2, score: 4, allowShuffleAlternatives: true },
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
      patch: (path: string, body?: object) => request(app).patch(path).set(authorization).send(body),
    }
  }
  const ana = () => asTeacher('token-ana')
  const bia = () => asTeacher('token-bia')

  /** A generated application of Ana with one version and three sheets: one printed for `student-1`, two without a name. */
  async function printedApplication(teacherId = 'ana', classId = 'class-ana', examId = 'exam-ana') {
    const applicationId = randomUUID()
    await db
      .insertInto('applications')
      .values({ id: applicationId, examId, classId, teacherId, status: 'generated', pdfUrl: null, date: new Date('2026-10-05T12:00:00.000Z'), gradesReleased: false })
      .execute()
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
    const sheets = [sheet(1, 'student-1'), sheet(2, null), sheet(3, null)] as const
    await db.insertInto('answer_sheets').values([...sheets]).execute()
    return { applicationId, versionId, named: sheets[0].id, blank: sheets[1].id, otherBlank: sheets[2].id }
  }

  const correctionsOf = (applicationId: string) => `/applications/${applicationId}/corrections`

  /** Right on `q-limits`, wrong on `q-old`, 3.5 on the essay: 3 + 0 + 3.5. */
  const FULL_REVIEW = {
    answers: [
      { questionId: 'q-limits', selectedAlternativeId: 'lim-b' },
      { questionId: 'q-old', selectedAlternativeId: 'old-b' },
    ],
    discursiveScores: [{ questionId: 'q-essay', score: 3.5 }],
    finalize: true,
  }

  describe('POST /applications/:id/corrections', () => {
    it('grades on the server, ignoring what the client says is right, worth or finished', async () => {
      const { applicationId, versionId, named } = await printedApplication()

      const response = await ana().post(correctionsOf(applicationId), {
        ...FULL_REVIEW,
        answerSheetId: named,
        totalScore: 99,
        status: 'DONE',
        objectiveResults: [{ questionId: 'q-old', correct: true, score: 3 }],
      })

      expect(response.status).toBe(201)
      const body = response.body as Correction
      expect(body).toMatchObject({
        examVersionId: versionId,
        answerSheetId: named,
        objectiveResults: [
          { questionId: 'q-limits', correct: true, score: 3, selectedAlternativeId: 'lim-b' },
          { questionId: 'q-old', correct: false, score: 0, selectedAlternativeId: 'old-b' },
        ],
        discursiveScores: [{ questionId: 'q-essay', score: 3.5 }],
        totalScore: 6.5,
        status: 'DONE',
        source: 'MANUAL',
        correctedBy: 'ana',
        studentId: 'student-1',
        isAutomaticallyAssigned: true,
        syncStatus: 'synced',
      })
      expect(body.clientCorrectionId).toMatch(/^[0-9a-f-]{36}$/)
      expect((await ana().get(`${correctionsOf(applicationId)}/${body.id}`)).body).toEqual(body)
    })

    /** RF47: saving without finishing, or finishing before every open-ended question has a mark, stays in progress. */
    it('stays in progress until the teacher finalizes with every open-ended question marked', async () => {
      const { applicationId, blank, otherBlank } = await printedApplication()

      const saved = await ana().post(correctionsOf(applicationId), { ...FULL_REVIEW, answerSheetId: blank, finalize: false })
      const unmarked = await ana().post(correctionsOf(applicationId), { ...FULL_REVIEW, answerSheetId: otherBlank, discursiveScores: [] })

      expect(saved.body.status).toBe('IN_PROGRESS')
      expect(unmarked.body.status).toBe('IN_PROGRESS')
      expect(unmarked.body.objectiveResults).toHaveLength(2)
    })

    /** A blank or missing answer is wrong, not absent, so the total always matches the paper. */
    it('grades every multiple-choice question of the exam, a blank or missing answer as wrong', async () => {
      const { applicationId, blank } = await printedApplication()

      const response = await ana().post(correctionsOf(applicationId), { answerSheetId: blank, answers: [{ questionId: 'q-limits' }], finalize: false })

      expect(response.body.objectiveResults).toEqual([
        { questionId: 'q-limits', correct: false, score: 0 },
        { questionId: 'q-old', correct: false, score: 0 },
      ])
      expect(response.body.totalScore).toBe(0)
    })

    it.each([
      ['an alternative of another question', { answers: [{ questionId: 'q-limits', selectedAlternativeId: 'old-a' }] }, 'Uma das alternativas marcadas não é da sua questão.'],
      ['a question that is not in the exam', { answers: [{ questionId: 'q-nowhere', selectedAlternativeId: 'lim-a' }] }, 'Uma das respostas não é de uma questão objetiva desta prova.'],
      ['a mark for a multiple-choice question', { discursiveScores: [{ questionId: 'q-limits', score: 1 }] }, 'Uma das notas não é de uma questão discursiva desta prova.'],
      ['a mark above what the question is worth', { discursiveScores: [{ questionId: 'q-essay', score: 4.5 }] }, 'Uma nota de discursiva passa do valor da questão (4).'],
      ['the same question twice', { answers: [{ questionId: 'q-limits' }, { questionId: 'q-limits', selectedAlternativeId: 'lim-a' }] }, 'A mesma questão aparece duas vezes.'],
    ])('refuses %s', async (_case, review, message) => {
      const { applicationId, blank } = await printedApplication()

      const response = await ana().post(correctionsOf(applicationId), { answerSheetId: blank, finalize: false, ...review })

      expect(response.status).toBe(400)
      expect(response.body).toEqual({ code: 'invalid', message })
      expect(await db.selectFrom('corrections').select('id').execute()).toEqual([])
    })

    it('answers 404 for a sheet of another application', async () => {
      const { applicationId } = await printedApplication()
      const other = await printedApplication()

      const response = await ana().post(correctionsOf(applicationId), { ...FULL_REVIEW, answerSheetId: other.blank })

      expect(response.status).toBe(404)
      expect(response.body.message).toBe('Folha não encontrada.')
    })

    /** One correction per sheet: a second one is an edit, and the first is never overwritten. */
    it('refuses a second correction of the same sheet', async () => {
      const { applicationId, blank } = await printedApplication()
      await ana().post(correctionsOf(applicationId), { ...FULL_REVIEW, answerSheetId: blank })

      const again = await ana().post(correctionsOf(applicationId), { ...FULL_REVIEW, answerSheetId: blank, finalize: false })

      expect(again.status).toBe(409)
      expect(again.body.message).toBe('Esta folha já tem correção. Edite a correção existente.')
    })

    /** An app migrating onto the API sends its own key and sync state; the API keeps them, and the same key twice is one correction. */
    it('keeps the key and the sync state an app sends, and refuses the same key twice', async () => {
      const { applicationId, blank, otherBlank } = await printedApplication()

      const first = await ana().post(correctionsOf(applicationId), { ...FULL_REVIEW, answerSheetId: blank, clientCorrectionId: 'app-123', syncStatus: 'pending' })
      const repeated = await ana().post(correctionsOf(applicationId), { ...FULL_REVIEW, answerSheetId: otherBlank, clientCorrectionId: 'app-123' })

      expect(first.body).toMatchObject({ clientCorrectionId: 'app-123', syncStatus: 'pending' })
      expect(repeated.status).toBe(409)
      expect(repeated.body.message).toBe('Esta correção já foi enviada.')
    })

    it('refuses a body that does not say whether the correction is finished', async () => {
      const { applicationId, blank } = await printedApplication()

      const response = await ana().post(correctionsOf(applicationId), { answerSheetId: blank })

      expect(response.body).toEqual({ code: 'invalid', message: 'Informe se a correção fica finalizada.' })
    })
  })

  describe('PATCH /applications/:id/corrections/:correctionId', () => {
    async function corrected(sheet: 'named' | 'blank' | 'otherBlank', review: object = FULL_REVIEW) {
      const printed = await printedApplication()
      const response = await ana().post(correctionsOf(printed.applicationId), { ...review, answerSheetId: printed[sheet] })
      return { ...printed, correction: response.body as Correction, path: `${correctionsOf(printed.applicationId)}/${(response.body as Correction).id}` }
    }

    /** `{ ...current, ...sent }`: a field left out is never erased, the key and sync state included. */
    it('merges what is sent with what is stored, and grades again', async () => {
      const { correction, path } = await corrected('blank', { ...FULL_REVIEW, notes: 'Letra difícil', clientCorrectionId: 'app-7', syncStatus: 'pending' })

      const response = await ana().patch(path, { answers: [{ questionId: 'q-limits', selectedAlternativeId: 'lim-a' }, { questionId: 'q-old', selectedAlternativeId: 'old-a' }] })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        id: correction.id,
        notes: 'Letra difícil',
        clientCorrectionId: 'app-7',
        syncStatus: 'pending',
        discursiveScores: [{ questionId: 'q-essay', score: 3.5 }],
        objectiveResults: [
          { questionId: 'q-limits', correct: false, score: 0, selectedAlternativeId: 'lim-a' },
          { questionId: 'q-old', correct: true, score: 3, selectedAlternativeId: 'old-a' },
        ],
        totalScore: 6.5,
        status: 'DONE',
      })
    })

    it('finishes a correction once the open-ended mark arrives', async () => {
      const { path } = await corrected('blank', { ...FULL_REVIEW, discursiveScores: [], finalize: false })

      const response = await ana().patch(path, { discursiveScores: [{ questionId: 'q-essay', score: 0 }], finalize: true })

      expect(response.body).toMatchObject({ status: 'DONE', totalScore: 3 })
    })

    /** RF31: a sheet without a name gets the student the teacher picks, from the class. */
    it('assigns a student to a sheet without a name', async () => {
      const { path } = await corrected('blank')

      const response = await ana().patch(path, { studentId: 'student-2' })

      expect(response.body).toMatchObject({ studentId: 'student-2', isAutomaticallyAssigned: false })
    })

    it('refuses a student of another class, and another student on a sheet printed with a name', async () => {
      const blank = await corrected('blank')
      const named = await corrected('named')

      const otherClass = await ana().patch(blank.path, { studentId: 'student-x' })
      const otherStudent = await ana().patch(named.path, { studentId: 'student-2' })

      expect(otherClass.body).toEqual({ code: 'invalid', message: 'O aluno não é desta turma.' })
      expect(otherStudent.body).toEqual({ code: 'invalid', message: 'Esta folha já traz o aluno impresso nela.' })
    })

    it('refuses the same student twice on one version', async () => {
      const { applicationId, named, blank } = await printedApplication()
      await ana().post(correctionsOf(applicationId), { ...FULL_REVIEW, answerSheetId: named })
      const second = await ana().post(correctionsOf(applicationId), { ...FULL_REVIEW, answerSheetId: blank })

      const response = await ana().patch(`${correctionsOf(applicationId)}/${(second.body as Correction).id}`, { studentId: 'student-1' })

      expect(response.status).toBe(409)
      expect(response.body.message).toBe('Já existe uma correção deste aluno nesta versão. Verifique se duas folhas foram lidas como a mesma pessoa.')
    })
  })

  describe('GET /applications/:id/corrections', () => {
    it('lists the corrections in sheet order, and filters those waiting for a student or still open', async () => {
      const { applicationId, named, blank, otherBlank } = await printedApplication()
      for (const [sheet, finalize] of [[otherBlank, false], [named, true], [blank, true]] as const) {
        await ana().post(correctionsOf(applicationId), { ...FULL_REVIEW, answerSheetId: sheet, finalize })
      }

      const all = await ana().get(correctionsOf(applicationId))
      const unassigned = await ana().get(`${correctionsOf(applicationId)}?assigned=false`)
      const open = await ana().get(`${correctionsOf(applicationId)}?status=IN_PROGRESS`)

      expect(all.body.total).toBe(3)
      expect((all.body.items as Correction[]).map((item) => item.answerSheetId)).toEqual([named, blank, otherBlank])
      expect((unassigned.body.items as Correction[]).map((item) => item.answerSheetId)).toEqual([blank, otherBlank])
      expect((open.body.items as Correction[]).map((item) => item.answerSheetId)).toEqual([otherBlank])
    })

    it('refuses a filter it cannot honour', async () => {
      const { applicationId } = await printedApplication()

      expect((await ana().get(`${correctionsOf(applicationId)}?status=FINISHED`)).status).toBe(400)
      expect((await ana().get(`${correctionsOf(applicationId)}?assigned=maybe`)).status).toBe(400)
    })
  })

  /** A correction belongs to the application's teacher: to anyone else it does not exist (404, never 403). */
  it('answers 404 to another teacher on every route, and 401 without a session', async () => {
    const { applicationId, blank } = await printedApplication()
    const created = await ana().post(correctionsOf(applicationId), { ...FULL_REVIEW, answerSheetId: blank })
    const path = `${correctionsOf(applicationId)}/${(created.body as Correction).id}`

    const responses = await Promise.all([
      bia().get(correctionsOf(applicationId)),
      bia().get(path),
      bia().post(correctionsOf(applicationId), { ...FULL_REVIEW, answerSheetId: blank }),
      bia().patch(path, { notes: 'Minha' }),
    ])

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404, 404])
    expect((await ana().get(path)).body.notes).toBeUndefined()
    expect((await request(app).get(correctionsOf(applicationId))).status).toBe(401)
  })
})
