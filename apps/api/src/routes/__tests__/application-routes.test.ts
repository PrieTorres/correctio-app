import { randomBytes, randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Application, ExamVersionLayout } from '@correctio/domain'
import type { Express } from 'express'
import type { Insertable, Kysely } from 'kysely'
import request, { type Response } from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, DATABASE_TEST_URL, type TestDatabase } from '../../__tests__/test-database'
import { createApp } from '../../app'
import { loadEnv } from '../../config/env'
import { createLocalFileStorage, type FileStorage } from '../../lib/file-storage'
import { createLogger } from '../../lib/logger'
import type { VerifyToken } from '../../middlewares/require-auth'
import type { ApplicationsTable, Database, ExamVersionsTable } from '../../models/tables'

const TOKENS: Readonly<Record<string, string>> = { 'token-ana': 'ana', 'token-bia': 'bia' }
const verifyToken: VerifyToken = (token) => {
  const teacherId = TOKENS[token]
  return Promise.resolve(teacherId === undefined ? null : { teacherId })
}

/** Generous budgets: these tests are about the routes, and `rate-limit.test.ts` covers the limits. */
const RELAXED = { windowMs: 60_000, limit: 10_000 }

const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent' })

const LAYOUT: ExamVersionLayout = {
  questionOrder: ['q-limits', 'q-continuity'],
  alternativeOrder: [{ questionId: 'q-limits', printedOrder: ['q-limits-1', 'q-limits-0'] }],
}

/** Not a real PDF: the route hands back whatever bytes the storage holds. */
const PDF_BYTES = Buffer.from('%PDF-1.7 prova de teste %%EOF')

const teacher = (id: string) => ({ id, role: 'professor' as const, fullName: id, email: `${id}@exemplo.edu.br`, passwordHash: 'x' })
const classOf = (id: string, teacherId: string) => ({ id, teacherId, name: id, subject: 'Matemática', term: '2026/2', status: 'active' as const, inviteCode: id.toUpperCase().slice(-8) })
const examOf = (id: string, teacherId: string) => ({
  id,
  teacherId,
  title: id,
  description: '',
  status: 'ready' as const,
  defaultShuffleQuestions: true,
  defaultShuffleAlternatives: true,
})

/** Noon UTC of the day, which is how the form of the web app stores a date. */
const day = (isoDay: string) => new Date(`${isoDay}T12:00:00.000Z`)

const itemsIn = (response: Response) => (response.body as { items: { id: string }[] }).items.map((item) => item.id)

describe.runIf(DATABASE_TEST_URL !== undefined)('application routes (real MySQL)', () => {
  let database: TestDatabase
  let db: Kysely<Database>
  let folder: string
  let fileStorage: FileStorage
  let app: Express

  /** Users, classes, exams and a student exist before any application, for the foreign keys. */
  beforeAll(async () => {
    database = await createTestDatabase()
    db = database.db
    await db.insertInto('users').values([teacher('ana'), teacher('bia')]).execute()
    await db
      .insertInto('classes')
      .values([classOf('class-ana', 'ana'), classOf('class-ana-2', 'ana'), classOf('class-bia', 'bia')])
      .execute()
    await db
      .insertInto('exams')
      .values([examOf('exam-ana', 'ana'), examOf('exam-ana-2', 'ana'), examOf('exam-bia', 'bia')])
      .execute()
    await db
      .insertInto('students')
      .values({ id: 'student-1', classId: 'class-ana', fullName: 'Ana Beatriz', registration: '202601', email: null, userId: null })
      .execute()

    folder = await mkdtemp(join(tmpdir(), 'correctio-files-'))
    fileStorage = createLocalFileStorage(folder)
    app = createApp({ env, logger: createLogger('silent'), db, verifyToken, fileStorage, rateLimits: { read: RELAXED, write: RELAXED } })
  })

  afterAll(async () => {
    await database.drop()
    await rm(folder, { recursive: true, force: true })
  })

  /** Sheets first, then versions, so no foreign key blocks the delete. */
  beforeEach(async () => {
    await db.deleteFrom('answer_sheets').execute()
    await db.deleteFrom('exam_versions').execute()
    await db.deleteFrom('applications').execute()
  })

  function asTeacher(token: string) {
    const authorization = { Authorization: `Bearer ${token}` }
    return {
      get: (path: string) => request(app).get(path).set(authorization),
      post: (path: string, body?: object) => request(app).post(path).set(authorization).send(body),
      patch: (path: string) => request(app).patch(path).set(authorization),
    }
  }
  const ana = () => asTeacher('token-ana')
  const bia = () => asTeacher('token-bia')

  async function insertApplication(fields: Partial<Insertable<ApplicationsTable>> = {}): Promise<string> {
    const id = randomUUID()
    await db
      .insertInto('applications')
      .values({
        id,
        examId: 'exam-ana',
        classId: 'class-ana',
        teacherId: 'ana',
        status: 'draft',
        pdfUrl: null,
        date: day('2026-10-05'),
        gradesReleased: false,
        ...fields,
      })
      .execute()
    return id
  }

  async function insertVersion(applicationId: string, versionNumber: number, fields: Partial<Insertable<ExamVersionsTable>> = {}) {
    const id = randomUUID()
    await db
      .insertInto('exam_versions')
      .values({
        id,
        applicationId,
        versionNumber,
        shuffleQuestions: false,
        shuffleAlternatives: true,
        withStudentIdentification: true,
        layout: JSON.stringify(LAYOUT),
        answerKeyPublished: false,
        publicCode: `PUB-${id}`,
        qrCodePayload: `QR-${id}`,
        ...fields,
      })
      .execute()
    return id
  }

  async function insertSheet(applicationId: string, examVersionId: string, sheetNumber: number, studentId?: string) {
    const sheet = { id: randomUUID(), applicationId, examVersionId, sheetNumber, code: randomBytes(13).toString('hex').toUpperCase() }
    await db
      .insertInto('answer_sheets')
      .values({ ...sheet, studentId: studentId ?? null })
      .execute()
    return sheet
  }

  const storedApplication = (id: string) => db.selectFrom('applications').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  const storedVersion = (id: string) =>
    db.selectFrom('exam_versions').select(['answerKeyPublished', 'answerKeyPublishedAt']).where('id', '=', id).executeTakeFirstOrThrow()

  it('requires a signed-in teacher on every application route', async () => {
    const id = randomUUID()
    const responses = await Promise.all([
      request(app).get('/applications'),
      request(app).get(`/applications/${id}`),
      request(app).patch(`/applications/${id}/archive`),
      request(app).patch(`/applications/${id}/restore`),
      request(app).post(`/applications/${id}/grades-release`),
      request(app).get(`/applications/${id}/pdf`),
      request(app).get(`/applications/${id}/versions`),
      request(app).post(`/applications/${id}/versions/${id}/publish-answer-key`),
      request(app).get(`/applications/${id}/sheets`),
    ])

    for (const response of responses) expect(response.status).toBe(401)
  })

  describe('GET /applications', () => {
    it('lists only the applications of the teacher, the oldest first, with the fields of the contract', async () => {
      const later = await insertApplication({ date: day('2026-12-01') })
      const earlier = await insertApplication({ date: day('2026-03-01'), status: 'generated', pdfUrl: 'applications/earlier/prova.pdf' })
      await insertApplication({ teacherId: 'bia', examId: 'exam-bia', classId: 'class-bia' })

      const response = await ana().get('/applications')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        total: 2,
        items: [
          {
            id: earlier,
            examId: 'exam-ana',
            classId: 'class-ana',
            teacherId: 'ana',
            status: 'generated',
            pdfUrl: `/applications/${earlier}/pdf`,
            date: '2026-03-01T12:00:00.000Z',
            gradesReleased: false,
          },
          {
            id: later,
            examId: 'exam-ana',
            classId: 'class-ana',
            teacherId: 'ana',
            status: 'draft',
            date: '2026-12-01T12:00:00.000Z',
            gradesReleased: false,
          },
        ],
      })
    })

    /** The column keeps where the file is stored, which is nobody's business outside the API. */
    it('never hands out the storage key of the PDF', async () => {
      await insertApplication({ status: 'generated', pdfUrl: 'applications/secret-folder/prova.pdf' })

      expect(JSON.stringify((await ana().get('/applications')).body)).not.toContain('secret-folder')
    })

    it('lists the archived applications only when asked', async () => {
      const archived = await insertApplication({ status: 'closed' })
      const draft = await insertApplication({ date: day('2026-10-06') })
      const generated = await insertApplication({ date: day('2026-10-07'), status: 'generated' })

      expect(itemsIn(await ana().get('/applications'))).toEqual([draft, generated])
      expect(itemsIn(await ana().get('/applications').query({ archived: 'true' }))).toEqual([archived])
    })

    it('filters by class, exam and status before paging', async () => {
      const first = await insertApplication({ date: day('2026-10-01') })
      const otherClass = await insertApplication({ date: day('2026-10-02'), classId: 'class-ana-2', status: 'generated' })
      const otherExam = await insertApplication({ date: day('2026-10-03'), examId: 'exam-ana-2', status: 'generated' })

      expect(itemsIn(await ana().get('/applications').query({ classId: 'class-ana' }))).toEqual([first, otherExam])
      expect(itemsIn(await ana().get('/applications').query({ examId: 'exam-ana' }))).toEqual([first, otherClass])
      expect(itemsIn(await ana().get('/applications').query({ status: 'generated' }))).toEqual([otherClass, otherExam])
      expect(itemsIn(await ana().get('/applications').query({ classId: 'class-ana', status: 'generated' }))).toEqual([otherExam])

      const paged = await ana().get('/applications').query({ status: 'generated', pageSize: 1, page: 2 })
      expect(paged.body.total).toBe(2)
      expect(itemsIn(paged)).toEqual([otherExam])
    })

    it('matches nothing for a class of another teacher', async () => {
      await insertApplication({ teacherId: 'bia', examId: 'exam-bia', classId: 'class-bia' })

      expect((await ana().get('/applications').query({ classId: 'class-bia' })).body).toEqual({ items: [], total: 0 })
    })

    it('finds an application by its day, typed as the screen prints it or as ISO', async () => {
      const october = await insertApplication({ date: day('2026-10-05') })
      const november = await insertApplication({ date: day('2026-11-20') })
      const search = async (term: string) => itemsIn(await ana().get('/applications').query({ search: term }))

      expect(await search('05/10/2026')).toEqual([october])
      expect(await search('05/10')).toEqual([october])
      expect(await search('2026-10-05')).toEqual([october])
      expect(await search('2026-11')).toEqual([november])
      expect(await search('/2026')).toEqual([october, november])
      expect(await search('calculo')).toEqual([])
    })

    it('takes % and _ in the search literally', async () => {
      await insertApplication()

      expect(itemsIn(await ana().get('/applications').query({ search: '%' }))).toEqual([])
      expect(itemsIn(await ana().get('/applications').query({ search: '_' }))).toEqual([])
    })

    it('refuses a status that does not exist, naming the parameter', async () => {
      const response = await ana().get('/applications').query({ status: 'archived' })

      expect(response.status).toBe(400)
      expect(response.body).toEqual({ code: 'invalid', message: 'Parâmetro de lista inválido: status.' })
    })
  })

  describe('GET /applications/:id', () => {
    it('answers an application of the teacher', async () => {
      const id = await insertApplication({ gradesReleased: true })

      expect((await ana().get(`/applications/${id}`)).body).toEqual({
        id,
        examId: 'exam-ana',
        classId: 'class-ana',
        teacherId: 'ana',
        status: 'draft',
        date: '2026-10-05T12:00:00.000Z',
        gradesReleased: true,
      })
    })

    it('answers 404, never 403, for an application of another teacher or one that does not exist', async () => {
      const id = await insertApplication()
      const fromBia = await bia().get(`/applications/${id}`)

      expect(fromBia.status).toBe(404)
      expect(fromBia.body).toEqual({ code: 'not-found', message: 'Aplicação não encontrada.' })
      expect((await ana().get(`/applications/${randomUUID()}`)).status).toBe(404)
    })
  })

  describe('archive and restore', () => {
    it('archives without deleting, and restores as a draft rather than as generated', async () => {
      const id = await insertApplication({ status: 'generated', pdfUrl: 'applications/a/prova.pdf' })

      expect((await ana().patch(`/applications/${id}/archive`)).status).toBe(204)
      expect((await storedApplication(id)).status).toBe('closed')
      expect((await ana().get(`/applications/${id}`)).body.status).toBe('closed')

      expect((await ana().patch(`/applications/${id}/restore`)).status).toBe(204)
      expect(await storedApplication(id)).toMatchObject({ status: 'draft', pdfUrl: 'applications/a/prova.pdf' })
    })

    it('leaves an application that is not archived as it is when restored', async () => {
      const id = await insertApplication({ status: 'generated' })

      expect((await ana().patch(`/applications/${id}/restore`)).status).toBe(204)
      expect((await storedApplication(id)).status).toBe('generated')
    })

    it('answers 404 to another teacher, without archiving or restoring anything', async () => {
      const active = await insertApplication()
      const archived = await insertApplication({ status: 'closed' })

      expect((await bia().patch(`/applications/${active}/archive`)).status).toBe(404)
      expect((await bia().patch(`/applications/${archived}/restore`)).status).toBe(404)
      expect((await storedApplication(active)).status).toBe('draft')
      expect((await storedApplication(archived)).status).toBe('closed')
    })
  })

  describe('GET /applications/:id/versions', () => {
    it('lists the versions by number, with the layout that was printed', async () => {
      const id = await insertApplication({ status: 'generated' })
      const second = await insertVersion(id, 2)
      const first = await insertVersion(id, 1, { answerKeyPublished: true, answerKeyPublishedAt: day('2026-10-06') })

      const response = await ana().get(`/applications/${id}/versions`)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        total: 2,
        items: [
          {
            id: first,
            applicationId: id,
            versionNumber: 1,
            shuffleQuestions: false,
            shuffleAlternatives: true,
            withStudentIdentification: true,
            layout: LAYOUT,
            answerKeyPublished: true,
            answerKeyPublishedAt: '2026-10-06T12:00:00.000Z',
            publicCode: `PUB-${first}`,
            qrCodePayload: `QR-${first}`,
          },
          {
            id: second,
            applicationId: id,
            versionNumber: 2,
            shuffleQuestions: false,
            shuffleAlternatives: true,
            withStudentIdentification: true,
            layout: LAYOUT,
            answerKeyPublished: false,
            publicCode: `PUB-${second}`,
            qrCodePayload: `QR-${second}`,
          },
        ],
      })
    })

    it('pages the versions, and answers an empty page when nothing was printed', async () => {
      const printed = await insertApplication({ status: 'generated' })
      await insertVersion(printed, 1)
      const second = await insertVersion(printed, 2)
      const empty = await insertApplication()

      const paged = await ana().get(`/applications/${printed}/versions`).query({ page: 2, pageSize: 1 })
      expect(paged.body.total).toBe(2)
      expect(itemsIn(paged)).toEqual([second])
      expect((await ana().get(`/applications/${empty}/versions`)).body).toEqual({ items: [], total: 0 })
    })

    it('answers 404 to another teacher', async () => {
      const id = await insertApplication()
      await insertVersion(id, 1)

      expect((await bia().get(`/applications/${id}/versions`)).status).toBe(404)
    })
  })

  describe('GET /applications/:id/sheets', () => {
    it('lists the sheets by number, with the student only on an identified sheet', async () => {
      const id = await insertApplication({ status: 'generated' })
      const version = await insertVersion(id, 1)
      const anonymous = await insertSheet(id, version, 2)
      const identified = await insertSheet(id, version, 1, 'student-1')

      const response = await ana().get(`/applications/${id}/sheets`)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        total: 2,
        items: [{ ...identified, studentId: 'student-1' }, anonymous],
      })
    })

    it('answers 404 to another teacher', async () => {
      const id = await insertApplication()
      await insertSheet(id, await insertVersion(id, 1), 1)

      expect((await bia().get(`/applications/${id}/sheets`)).status).toBe(404)
    })
  })

  describe('POST /applications/:id/versions/:versionId/publish-answer-key', () => {
    const publishPath = (id: string, versionId: string) => `/applications/${id}/versions/${versionId}/publish-answer-key`

    it('publishes the answer key as of that moment, and takes it back', async () => {
      const id = await insertApplication({ status: 'generated' })
      const version = await insertVersion(id, 1)
      const before = Date.now()

      expect((await ana().post(publishPath(id, version), { published: true })).status).toBe(204)
      const published = await storedVersion(version)
      expect(published.answerKeyPublished).toBe(true)
      expect(published.answerKeyPublishedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000)
      expect(published.answerKeyPublishedAt?.getTime()).toBeLessThanOrEqual(Date.now() + 1000)

      expect((await ana().post(publishPath(id, version), { published: false })).status).toBe(204)
      expect(await storedVersion(version)).toEqual({ answerKeyPublished: false, answerKeyPublishedAt: null })
    })

    it('keeps the moment of the first publication when published again', async () => {
      const id = await insertApplication({ status: 'generated' })
      const version = await insertVersion(id, 1, { answerKeyPublished: true, answerKeyPublishedAt: day('2026-10-01') })

      expect((await ana().post(publishPath(id, version), { published: true })).status).toBe(204)
      expect((await storedVersion(version)).answerKeyPublishedAt).toEqual(day('2026-10-01'))
    })

    /** RF46: once grades are out, the key is what explains them. */
    it('refuses taking the key back while the grades are released', async () => {
      const id = await insertApplication({ status: 'generated', gradesReleased: true })
      const version = await insertVersion(id, 1, { answerKeyPublished: true, answerKeyPublishedAt: day('2026-10-01') })

      const response = await ana().post(publishPath(id, version), { published: false })

      expect(response.status).toBe(409)
      expect(response.body).toEqual({
        code: 'conflict',
        message: 'Recolha as notas antes de despublicar o gabarito: a nota nunca aparece sem ele.',
      })
      expect((await storedVersion(version)).answerKeyPublished).toBe(true)
    })

    it('refuses a body that does not say whether to publish', async () => {
      const id = await insertApplication({ status: 'generated' })
      const version = await insertVersion(id, 1)

      const withoutFlag = await ana().post(publishPath(id, version), {})
      const notAnObject = await ana().post(publishPath(id, version), [true])

      expect(withoutFlag.body).toEqual({ code: 'invalid', message: 'Informe se o gabarito fica publicado.' })
      expect(notAnObject.body).toEqual({ code: 'invalid', message: 'Dados inválidos.' })
      expect((await storedVersion(version)).answerKeyPublished).toBe(false)
    })

    it('answers 404 for a version of another application, and to another teacher', async () => {
      const id = await insertApplication({ status: 'generated' })
      const version = await insertVersion(id, 1)
      const otherApplication = await insertApplication({ status: 'generated', date: day('2026-10-06') })
      const otherVersion = await insertVersion(otherApplication, 1)

      const wrongApplication = await ana().post(publishPath(id, otherVersion), { published: true })
      const fromBia = await bia().post(publishPath(id, version), { published: true })

      expect(wrongApplication.status).toBe(404)
      expect(wrongApplication.body.message).toBe('Versão não encontrada.')
      expect(fromBia.status).toBe(404)
      expect(fromBia.body.message).toBe('Aplicação não encontrada.')
      expect((await storedVersion(version)).answerKeyPublished).toBe(false)
      expect((await storedVersion(otherVersion)).answerKeyPublished).toBe(false)
    })
  })

  describe('POST /applications/:id/grades-release', () => {
    const releasePath = (id: string) => `/applications/${id}/grades-release`

    it('refuses releasing the grades of an application with nothing printed', async () => {
      const id = await insertApplication()

      const response = await ana().post(releasePath(id), { released: true })

      expect(response.status).toBe(409)
      expect(response.body).toEqual({ code: 'conflict', message: 'Gere a prova antes de liberar as notas.' })
      expect((await storedApplication(id)).gradesReleased).toBe(false)
    })

    it('refuses releasing while any version has its answer key unpublished', async () => {
      const id = await insertApplication({ status: 'generated' })
      await insertVersion(id, 1, { answerKeyPublished: true, answerKeyPublishedAt: day('2026-10-06') })
      await insertVersion(id, 2)

      const response = await ana().post(releasePath(id), { released: true })

      expect(response.status).toBe(409)
      expect(response.body.message).toBe('Publique o gabarito de todas as versões antes de liberar as notas.')
      expect((await storedApplication(id)).gradesReleased).toBe(false)
    })

    it('releases once every answer key is published, answering the application', async () => {
      const id = await insertApplication({ status: 'generated' })
      await insertVersion(id, 1, { answerKeyPublished: true, answerKeyPublishedAt: day('2026-10-06') })
      await insertVersion(id, 2, { answerKeyPublished: true, answerKeyPublishedAt: day('2026-10-06') })

      const response = await ana().post(releasePath(id), { released: true })

      expect(response.status).toBe(200)
      expect(response.body).toEqual<Application>({
        id,
        examId: 'exam-ana',
        classId: 'class-ana',
        teacherId: 'ana',
        status: 'generated',
        date: '2026-10-05T12:00:00.000Z',
        gradesReleased: true,
      })
      expect((await storedApplication(id)).gradesReleased).toBe(true)
    })

    it('always lets the grades be taken back', async () => {
      const id = await insertApplication({ status: 'generated', gradesReleased: true })
      await insertVersion(id, 1)

      const response = await ana().post(releasePath(id), { released: false })

      expect(response.status).toBe(200)
      expect(response.body.gradesReleased).toBe(false)
      expect((await storedApplication(id)).gradesReleased).toBe(false)
    })

    it('refuses a body that does not say whether to release', async () => {
      const id = await insertApplication()

      expect((await ana().post(releasePath(id), { released: 'sim' })).body).toEqual({
        code: 'invalid',
        message: 'Informe se as notas ficam liberadas.',
      })
      expect((await ana().post(releasePath(id))).body).toEqual({ code: 'invalid', message: 'Dados inválidos.' })
    })

    it('answers 404 to another teacher, releasing nothing', async () => {
      const id = await insertApplication({ status: 'generated' })
      await insertVersion(id, 1, { answerKeyPublished: true, answerKeyPublishedAt: day('2026-10-06') })

      expect((await bia().post(releasePath(id), { released: true })).status).toBe(404)
      expect((await storedApplication(id)).gradesReleased).toBe(false)
    })

    /**
     * RF46 with two tabs open: one releases the grades while the other takes
     * the only answer key back. Each request is allowed on its own, and each
     * checks the other's switch, so only the lock keeps both from passing.
     * Exactly one wins, and the application never ends with released grades
     * and no key. Repeated, since a race does not show on every run.
     */
    it('never leaves released grades without their key when both requests arrive together', async () => {
      for (let round = 0; round < 15; round++) {
        const id = await insertApplication({ status: 'generated' })
        const version = await insertVersion(id, 1, { answerKeyPublished: true, answerKeyPublishedAt: day('2026-10-06') })

        const [release, takeBack] = await Promise.all([
          ana().post(releasePath(id), { released: true }),
          ana().post(`/applications/${id}/versions/${version}/publish-answer-key`, { published: false }),
        ])

        const gradesReleased = (await storedApplication(id)).gradesReleased
        const keyPublished = (await storedVersion(version)).answerKeyPublished
        expect(gradesReleased && !keyPublished).toBe(false)
        expect([release.status, takeBack.status].filter((status) => status === 409)).toHaveLength(1)
      }
    })
  })

  describe('GET /applications/:id/pdf', () => {
    const pdfPath = (id: string) => `/applications/${id}/pdf`

    it('downloads the stored PDF as a file named after the day, never cached', async () => {
      const key = `applications/${randomUUID()}/prova.pdf`
      await fileStorage.save(key, PDF_BYTES, 'application/pdf')
      const id = await insertApplication({ status: 'generated', pdfUrl: key })

      const response = await ana().get(pdfPath(id)).responseType('blob')

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe('application/pdf')
      expect(response.headers['content-disposition']).toBe('attachment; filename=prova-2026-10-05.pdf')
      expect(response.headers['cache-control']).toBe('no-store')
      expect(Buffer.compare(response.body as Buffer, PDF_BYTES)).toBe(0)
    })

    it('answers 404 while no PDF was generated', async () => {
      const id = await insertApplication()

      const response = await ana().get(pdfPath(id))

      expect(response.status).toBe(404)
      expect(response.body).toEqual({ code: 'not-found', message: 'O PDF desta aplicação ainda não foi gerado.' })
    })

    it('answers a failure, not a missing PDF, when the storage lost the file', async () => {
      const id = await insertApplication({ status: 'generated', pdfUrl: `applications/${randomUUID()}/prova.pdf` })

      const response = await ana().get(pdfPath(id))

      expect(response.status).toBe(500)
      expect(response.body).toEqual({ code: 'failure', message: 'O arquivo do PDF não foi encontrado. Gere a prova de novo.' })
    })

    it('answers 404 to another teacher, whose file it is not', async () => {
      const key = `applications/${randomUUID()}/prova.pdf`
      await fileStorage.save(key, PDF_BYTES, 'application/pdf')
      const id = await insertApplication({ status: 'generated', pdfUrl: key })

      const response = await bia().get(pdfPath(id))

      expect(response.status).toBe(404)
      expect(response.body.message).toBe('Aplicação não encontrada.')
    })

    /** `bootstrapApi` always passes a storage; an app built without one must say so instead of serving nothing. */
    it('fails loudly in an app built without a file storage', async () => {
      const withoutStorage = createApp({ env, logger: createLogger('silent'), db, verifyToken })
      const id = await insertApplication({ status: 'generated', pdfUrl: 'applications/x/prova.pdf' })

      const response = await request(withoutStorage).get(pdfPath(id)).set({ Authorization: 'Bearer token-ana' })

      expect(response.status).toBe(500)
      expect(response.body).toEqual({ code: 'failure', message: 'O armazenamento de arquivos não está configurado.' })
    })
  })
})
