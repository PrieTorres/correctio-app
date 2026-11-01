import type { Exam, ExamQuestion } from '@correctio/domain'
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
import { createExamRepository } from '../../repositories/exam-repository'
import { QuestionRepository } from '../../repositories/question-repository'
import { createExamService } from '../../services/exam-service'

const TOKENS: Readonly<Record<string, string>> = { 'token-ana': 'ana', 'token-bia': 'bia' }
const verifyToken: VerifyToken = (token) => {
  const teacherId = TOKENS[token]
  return Promise.resolve(teacherId === undefined ? null : { teacherId })
}

/** Generous budgets: these tests are about the routes, and `rate-limit.test.ts` covers the limits. */
const RELAXED = { windowMs: 60_000, limit: 10_000 }

const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent' })

const teacher = (id: string) => ({ id, role: 'professor' as const, fullName: id, email: `${id}@exemplo.edu.br`, passwordHash: 'x' })

/** A question of `teacherId`; `deleted` marks one taken out of the bank after an exam used it. */
const question = (id: string, teacherId: string, type: 'objetiva' | 'discursiva', deleted = false) => ({
  id,
  teacherId,
  type,
  statement: id,
  correctAlternativeId: null,
  maxScore: type === 'discursiva' ? 2 : null,
  allowShuffleAlternatives: true,
  deletedAt: deleted ? new Date('2026-10-10T12:00:00.000Z') : null,
})

const entry = (questionId: string, order: number, score = 1): ExamQuestion => ({ questionId, order, score, allowShuffleAlternatives: true })

const FORM = {
  title: 'Cálculo I — Prova 1',
  description: 'Primeira avaliação',
  questions: [entry('q-limits', 0, 4), entry('q-essay', 1, 6)],
  defaultShuffleQuestions: true,
  defaultShuffleAlternatives: false,
}

describe.runIf(DATABASE_TEST_URL !== undefined)('exam routes (real MySQL)', () => {
  let database: TestDatabase
  let db: Kysely<Database>
  let app: Express

  /**
   * Ana's bank: three active multiple-choice questions, one open-ended, and one
   * deleted, tagged so the draw has something to filter. Bia has one question
   * of her own, which Ana can never use.
   */
  beforeAll(async () => {
    database = await createTestDatabase()
    db = database.db
    await db.insertInto('users').values([teacher('ana'), teacher('bia')]).execute()
    await db
      .insertInto('questions')
      .values([
        question('q-limits', 'ana', 'objetiva'),
        question('q-continuity', 'ana', 'objetiva'),
        question('q-derivative', 'ana', 'objetiva'),
        question('q-essay', 'ana', 'discursiva'),
        question('q-old', 'ana', 'objetiva', true),
        question('q-bia', 'bia', 'objetiva'),
      ])
      .execute()
    await db
      .insertInto('question_tags')
      .values([
        { questionId: 'q-limits', tag: 'Limites' },
        { questionId: 'q-limits', tag: 'Cálculo I' },
        { questionId: 'q-continuity', tag: 'Limites' },
        { questionId: 'q-derivative', tag: 'Derivadas' },
        { questionId: 'q-essay', tag: 'Limites' },
        { questionId: 'q-old', tag: 'Limites' },
        { questionId: 'q-bia', tag: 'Limites' },
      ])
      .execute()
    app = createApp({ env, logger: createLogger('silent'), db, verifyToken, rateLimits: { read: RELAXED, write: RELAXED } })
  })

  afterAll(async () => {
    await database.drop()
  })

  beforeEach(async () => {
    await db.deleteFrom('exam_questions').execute()
    await db.deleteFrom('exams').execute()
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

  async function created(form: object = FORM): Promise<Exam> {
    const response = await ana().post('/exams', form)
    expect(response.status).toBe(201)
    return response.body as Exam
  }

  describe('POST and GET /exams', () => {
    it('creates a draft with its questions, in order, owned by the teacher of the token', async () => {
      const exam = await created({ ...FORM, status: 'ready', teacherId: 'bia' })

      expect(exam).toMatchObject({ ...FORM, status: 'draft', teacherId: 'ana' })
      expect((await ana().get(`/exams/${exam.id}`)).body).toEqual(exam)
    })

    /** RF13: a question deleted from the bank stays in the exams that use it, so an old exam can still be saved. */
    it('accepts a question deleted from the bank', async () => {
      const exam = await created({ ...FORM, questions: [entry('q-old', 0)] })

      expect(exam.questions).toEqual([entry('q-old', 0)])
    })

    it.each([
      ['a question of another teacher', [entry('q-bia', 0)], 'Uma das questões não está no seu banco.'],
      ['a question that does not exist', [entry('q-nowhere', 0)], 'Uma das questões não está no seu banco.'],
      ['the same question twice', [entry('q-limits', 0), entry('q-limits', 1)], 'A mesma questão aparece duas vezes na prova.'],
      ['two questions in the same place', [entry('q-limits', 0), entry('q-essay', 0)], 'Duas questões ocupam a mesma posição na prova.'],
    ])('refuses %s', async (_case, questions, message) => {
      const response = await ana().post('/exams', { ...FORM, questions })

      expect(response.status).toBe(400)
      expect(response.body).toEqual({ code: 'invalid', message })
      expect(await db.selectFrom('exams').select('id').execute()).toEqual([])
    })

    /** RF15: twenty at most. */
    it('refuses more than 20 questions', async () => {
      const questions = Array.from({ length: 21 }, (_, index) => entry(`q-${index}`, index))

      const response = await ana().post('/exams', { ...FORM, questions })

      expect(response.body).toEqual({ code: 'invalid', message: 'Máximo de 20 questões por prova' })
    })

    it('refuses a title already used, without accents or case, and points at the archived one', async () => {
      const first = await created()
      const again = await ana().post('/exams', { ...FORM, title: 'calculo i — prova 1' })
      await ana().patch(`/exams/${first.id}/archive`)
      const afterArchive = await ana().post('/exams', { ...FORM, title: 'CÁLCULO I — PROVA 1' })

      expect(again.status).toBe(409)
      expect(again.body.message).toBe('Já existe uma prova com estes dados.')
      expect(afterArchive.body.message).toBe('Já existe uma prova arquivada com estes dados. Restaure em vez de criar outra.')
    })

    it('lets another teacher use the same title', async () => {
      await created()

      expect((await bia().post('/exams', { ...FORM, questions: [] })).status).toBe(201)
    })
  })

  describe('GET /exams', () => {
    it('lists the active exams by title, with their questions, and searches without accents', async () => {
      await created({ ...FORM, title: 'Física II — Teste' })
      await created()

      const all = await ana().get('/exams')
      const found = await ana().get('/exams?search=calculo')

      expect((all.body.items as Exam[]).map((exam) => exam.title)).toEqual(['Cálculo I — Prova 1', 'Física II — Teste'])
      expect(all.body.items[0].questions).toEqual(FORM.questions)
      expect((found.body.items as Exam[]).map((exam) => exam.title)).toEqual(['Cálculo I — Prova 1'])
    })

    it('separates the archived ones', async () => {
      const exam = await created()
      await ana().patch(`/exams/${exam.id}/archive`)

      expect((await ana().get('/exams')).body.total).toBe(0)
      expect((await ana().get('/exams?archived=true')).body.items[0]).toMatchObject({ id: exam.id, status: 'closed' })
    })
  })

  describe('PATCH /exams/:id', () => {
    /** `{ ...current, ...sent }`: a field left out keeps its value, and `status` never comes from the client. */
    it('merges what is sent, keeps the rest and never changes the status', async () => {
      const exam = await created()

      const response = await ana().patch(`/exams/${exam.id}`, { title: 'Cálculo I — Prova 1 (2ª chamada)', status: 'ready' })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ ...exam, title: 'Cálculo I — Prova 1 (2ª chamada)' })
      expect((await ana().get(`/exams/${exam.id}`)).body).toEqual(response.body)
    })

    it('replaces the questions when they are sent', async () => {
      const exam = await created()

      const response = await ana().patch(`/exams/${exam.id}`, { questions: [entry('q-derivative', 0, 10)] })

      expect(response.body.questions).toEqual([entry('q-derivative', 0, 10)])
      expect((await ana().get(`/exams/${exam.id}`)).body.questions).toEqual([entry('q-derivative', 0, 10)])
    })

    it('keeps its own title free for itself', async () => {
      const exam = await created()

      expect((await ana().patch(`/exams/${exam.id}`, { title: FORM.title, description: 'Revista' })).status).toBe(200)
    })
  })

  describe('archive and restore', () => {
    /** RF42, and `ready` is history rather than a state to hand back: a restored exam is a draft. */
    it('archives as closed and restores to draft, even an exam that was ready', async () => {
      const exam = await created()
      const service = createExamService({ exams: createExamRepository(db), questions: new QuestionRepository(db) })
      await service.markReady('ana', exam.id)

      expect((await ana().patch(`/exams/${exam.id}/archive`)).status).toBe(204)
      expect((await ana().get(`/exams/${exam.id}`)).body.status).toBe('closed')
      expect((await ana().patch(`/exams/${exam.id}/restore`)).status).toBe(204)
      expect((await ana().get(`/exams/${exam.id}`)).body.status).toBe('draft')
    })

    /** Applying an exam (#46) makes it `ready`; it never brings a closed exam back. */
    it('marks only a draft as ready', async () => {
      const draft = await created()
      const closed = await created({ ...FORM, title: 'Arquivada' })
      await ana().patch(`/exams/${closed.id}/archive`)
      const service = createExamService({ exams: createExamRepository(db), questions: new QuestionRepository(db) })

      await service.markReady('ana', draft.id)
      await service.markReady('ana', closed.id)

      expect((await ana().get(`/exams/${draft.id}`)).body.status).toBe('ready')
      expect((await ana().get(`/exams/${closed.id}`)).body.status).toBe('closed')
    })
  })

  describe('POST /exams/draw', () => {
    /** Asking for more than the bank has returns every match, so the result is known whatever the draw picks. */
    it('draws only active questions of the teacher, carrying every tag asked', async () => {
      const response = await ana().post('/exams/draw', { tags: ['Limites'], multipleChoiceCount: 5, openEndedCount: 1 })

      const ids = (response.body.questions as { id: string }[]).map((item) => item.id).sort()
      expect(response.status).toBe(200)
      expect(ids).toEqual(['q-continuity', 'q-essay', 'q-limits'])
      expect(response.body.shortfall).toEqual({ multipleChoice: 3, openEnded: 0 })
    })

    /** No question carries both tags, so a draw that wanted all of them would say the bank is empty. */
    it('draws the questions carrying any of the tags asked, not only those with all of them', async () => {
      const response = await ana().post('/exams/draw', { tags: ['Derivadas', 'Limites'], multipleChoiceCount: 5, openEndedCount: 1 })

      const ids = (response.body.questions as { id: string }[]).map((item) => item.id).sort()
      expect(ids).toEqual(['q-continuity', 'q-derivative', 'q-essay', 'q-limits'])
      expect(response.body.shortfall).toEqual({ multipleChoice: 2, openEnded: 0 })
    })

    it('leaves out the questions already in the exam or on screen', async () => {
      const response = await ana().post('/exams/draw', {
        tags: ['Limites'],
        multipleChoiceCount: 2,
        openEndedCount: 0,
        excludeIds: ['q-limits'],
      })

      expect((response.body.questions as { id: string }[]).map((item) => item.id)).toEqual(['q-continuity'])
      expect(response.body.shortfall).toEqual({ multipleChoice: 1, openEnded: 0 })
    })

    it('answers in the shape of the question bank, with every field of each question', async () => {
      const response = await ana().post('/exams/draw', { tags: ['Derivadas'], multipleChoiceCount: 1, openEndedCount: 0 })

      expect(response.body).toEqual({
        questions: [expect.objectContaining({ id: 'q-derivative', type: 'objetiva', statement: 'q-derivative', tags: ['Derivadas'] })],
        shortfall: null,
      })
    })

    it('refuses asking for more than an exam takes, and stores nothing', async () => {
      const response = await ana().post('/exams/draw', { tags: [], multipleChoiceCount: 15, openEndedCount: 6 })

      expect(response.body).toEqual({ code: 'invalid', message: 'Máximo de 20 questões por prova' })
      expect(await db.selectFrom('exams').select('id').execute()).toEqual([])
    })
  })

  /** An exam belongs to its teacher: to anyone else it does not exist (404, never 403). */
  it('answers 404 to another teacher on every route, and 401 without a session', async () => {
    const exam = await created()

    const responses = await Promise.all([
      bia().get(`/exams/${exam.id}`),
      bia().patch(`/exams/${exam.id}`, { title: 'Minha' }),
      bia().patch(`/exams/${exam.id}/archive`),
      bia().patch(`/exams/${exam.id}/restore`),
    ])

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404, 404])
    expect((await bia().get('/exams')).body.total).toBe(0)
    expect((await ana().get(`/exams/${exam.id}`)).body.title).toBe(FORM.title)
    expect((await request(app).get('/exams')).status).toBe(401)
  })
})
