import { randomBytes, randomUUID } from 'node:crypto'
import type { Correction } from '@correctio/domain'
import type { Express } from 'express'
import type { Kysely } from 'kysely'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, DATABASE_TEST_URL, type TestDatabase } from '../../__tests__/test-database'
import { createApp } from '../../app'
import { loadEnv } from '../../config/env'
import { createFieldCipher } from '../../lib/field-encryption'
import { createLogger } from '../../lib/logger'
import type { VerifyToken } from '../../middlewares/require-auth'
import type { Database } from '../../models/tables'
import { ACTIVITY_TYPE, AUDIT_ENTITY, createActivityLogRepository, type AuditEntry } from '../../repositories/activity-log-repository'
import { createCorrectionRepository } from '../../repositories/correction-repository'
import { createPrintingRepository } from '../../repositories/printing-repository'
import { createStudentRepository } from '../../repositories/student-repository'

const TOKENS: Readonly<Record<string, string>> = { 'token-ana': 'ana', 'token-bia': 'bia' }
const verifyToken: VerifyToken = (token) => {
  const teacherId = TOKENS[token]
  return Promise.resolve(teacherId === undefined ? null : { teacherId })
}

const RELAXED = { windowMs: 60_000, limit: 10_000 }

const NAME = 'Ana Beatriz Quintanilha'
const REGISTRATION = '2026-0042-QX'
const EMAIL = 'ana.quintanilha@exemplo.edu.br'
const STUDENT = { fullName: NAME, registration: REGISTRATION, email: EMAIL }
const NOTES = 'anotacao-sigilosa-da-professora'
const SCORE_MARKER = '3.5'

const teacher = (id: string) => ({ id, role: 'professor' as const, fullName: id, email: `${id}@exemplo.edu.br`, passwordHash: 'x' })

/** A teacher id that no `users` row has: the foreign key of the trail refuses it, which makes the audit write fail on purpose. */
const UNKNOWN_TEACHER = 'nobody'

describe.runIf(DATABASE_TEST_URL !== undefined)('audit trail (real MySQL)', () => {
  let database: TestDatabase
  let db: Kysely<Database>
  let app: Express
  let classId: string
  const fieldCipher = createFieldCipher(randomBytes(32).toString('base64'))

  beforeAll(async () => {
    database = await createTestDatabase()
    db = database.db
    await db.insertInto('users').values([teacher('ana'), teacher('bia')]).execute()
    await db
      .insertInto('questions')
      .values({ id: 'q-essay', teacherId: 'ana', type: 'discursiva', statement: 'q-essay', correctAlternativeId: null, maxScore: 4, allowShuffleAlternatives: true })
      .execute()
    await db
      .insertInto('exams')
      .values({ id: 'exam-ana', teacherId: 'ana', title: 'Prova', description: '', status: 'ready', defaultShuffleQuestions: false, defaultShuffleAlternatives: false })
      .execute()
    await db.insertInto('exam_questions').values({ examId: 'exam-ana', questionId: 'q-essay', order: 0, score: 4, allowShuffleAlternatives: true }).execute()
    app = createApp({
      env: loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }),
      logger: createLogger('silent'),
      db,
      verifyToken,
      fieldCipher,
      rateLimits: { read: RELAXED, write: RELAXED, expensive: RELAXED },
    })
  })

  afterAll(() => database.drop())

  beforeEach(async () => {
    await db.deleteFrom('activity_logs').execute()
    await db.deleteFrom('correction_objective_results').execute()
    await db.deleteFrom('correction_discursive_scores').execute()
    await db.deleteFrom('corrections').execute()
    await db.deleteFrom('answer_sheets').execute()
    await db.deleteFrom('exam_versions').execute()
    await db.deleteFrom('applications').execute()
    await db.deleteFrom('students').execute()
    await db.deleteFrom('classes').execute()
    classId = (await ana().post('/classes', { name: 'Cálculo I', subject: 'Matemática', term: '2026/2' })).body.id
  })

  function asTeacher(token: string) {
    const authorization = { Authorization: `Bearer ${token}` }
    return {
      get: (path: string) => request(app).get(path).set(authorization),
      post: (path: string, body?: object) => request(app).post(path).set(authorization).send(body),
      patch: (path: string, body?: object) => request(app).patch(path).set(authorization).send(body),
      delete: (path: string) => request(app).delete(path).set(authorization),
    }
  }
  const ana = () => asTeacher('token-ana')
  const bia = () => asTeacher('token-bia')

  const trail = (type?: string) => {
    const rows = db.selectFrom('activity_logs').selectAll()
    return (type === undefined ? rows : rows.where('type', '=', type)).orderBy('createdAt').execute()
  }

  async function expectNoPersonalData() {
    const text = JSON.stringify(await trail())
    for (const personal of [NAME, 'Quintanilha', REGISTRATION, EMAIL, NOTES, SCORE_MARKER]) expect(text).not.toContain(personal)
  }

  const addStudent = async (body: object = STUDENT) => (await ana().post(`/classes/${classId}/students`, body)).body.id as string
  const studentPath = (id: string) => `/classes/${classId}/students/${id}`

  describe('students', () => {
    it('records the creation of a student: author, type, entity and class, not the data', async () => {
      const id = await addStudent()

      const rows = await trail()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ teacherId: 'ana', type: ACTIVITY_TYPE.STUDENT_CREATED, entity: AUDIT_ENTITY.STUDENT, entityId: id, details: { classId } })
      expect(rows[0]?.createdAt).toBeInstanceOf(Date)
      await expectNoPersonalData()
    })

    it('records one creation per student of an import, and none for a row it skips', async () => {
      await addStudent()
      await db.deleteFrom('activity_logs').execute()

      const response = await ana().post(`/classes/${classId}/students/import`, {
        rows: [STUDENT, { fullName: 'Bruno Costa', registration: 'B-77' }, { fullName: 'Carla Dias', registration: 'C-88' }],
      })

      expect(response.body).toEqual({ created: 2, skipped: 1 })
      const rows = await trail(ACTIVITY_TYPE.STUDENT_CREATED)
      expect(rows).toHaveLength(2)
      const created = await db.selectFrom('students').select('id').where('registration', 'in', ['B-77', 'C-88']).execute()
      expect(rows.map((row) => row.entityId).sort()).toEqual(created.map((row) => row.id).sort())
      expect(JSON.stringify(rows)).not.toContain('Bruno')
    })

    it('records an edit with the names of the fields sent, never their values', async () => {
      const id = await addStudent()
      await db.deleteFrom('activity_logs').execute()

      await ana().patch(studentPath(id), { fullName: 'Nome Novo Secreto', email: null })

      const rows = await trail()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ teacherId: 'ana', type: ACTIVITY_TYPE.STUDENT_UPDATED, entityId: id, details: { classId, fields: ['fullName', 'email'] } })
      expect(JSON.stringify(rows)).not.toContain('Nome Novo Secreto')
      await expectNoPersonalData()
    })

    it('records the removal of a student from the class once', async () => {
      const id = await addStudent()
      await db.deleteFrom('activity_logs').execute()

      expect((await ana().delete(studentPath(id))).status).toBe(204)
      expect((await ana().delete(studentPath(id))).status).toBe(404)

      const rows = await trail()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ teacherId: 'ana', type: ACTIVITY_TYPE.STUDENT_REMOVED, entityId: id })
    })

    it('records an anonymization once, even when it is asked again', async () => {
      const id = await addStudent()
      await db.deleteFrom('activity_logs').execute()

      await ana().post(`${studentPath(id)}/anonymize`)
      await ana().post(`${studentPath(id)}/anonymize`)

      const rows = await trail()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ teacherId: 'ana', type: ACTIVITY_TYPE.STUDENT_ANONYMIZED, entityId: id })
      await expectNoPersonalData()
    })

    it("writes nothing when the operation fails or is not the teacher's", async () => {
      const id = await addStudent()
      await db.deleteFrom('activity_logs').execute()

      expect((await ana().post(`/classes/${classId}/students`, STUDENT)).status).toBe(409)
      expect((await ana().post(`/classes/${classId}/students`, { fullName: '' })).status).toBe(400)
      expect((await ana().post(`/classes/${classId}/students/import`, { rows: [{ fullName: 'Ok', registration: 'OK-1' }, { fullName: '' }] })).status).toBe(400)
      expect((await ana().patch(studentPath(id), { registration: '' })).status).toBe(400)
      expect((await bia().patch(studentPath(id), { fullName: 'Intruso' })).status).toBe(404)
      expect((await bia().delete(studentPath(id))).status).toBe(404)
      expect((await bia().post(`${studentPath(id)}/anonymize`)).status).toBe(404)
      expect((await ana().patch(studentPath(randomUUID()), { fullName: 'Ninguém' })).status).toBe(404)

      expect(await trail()).toHaveLength(0)
    })

    it('does not leave a student behind when its audit entry cannot be written', async () => {
      const students = createStudentRepository(db, fieldCipher)
      const audit: AuditEntry = { teacherId: UNKNOWN_TEACHER, type: ACTIVITY_TYPE.STUDENT_CREATED, entity: AUDIT_ENTITY.STUDENT, entityId: 'new-student' }

      await expect(students.insert([{ id: 'new-student', classId, fullName: NAME, registration: REGISTRATION }], [audit])).rejects.toThrow()

      expect(await db.selectFrom('students').selectAll().execute()).toHaveLength(0)
    })

    it('does not change or erase a student when the audit entry of the change cannot be written', async () => {
      const id = await addStudent()
      const students = createStudentRepository(db, fieldCipher)
      const audit: AuditEntry = { teacherId: UNKNOWN_TEACHER, type: ACTIVITY_TYPE.STUDENT_ANONYMIZED, entity: AUDIT_ENTITY.STUDENT, entityId: id }

      await expect(students.anonymize(classId, id, { fullName: 'x', registration: 'x', at: new Date() }, audit)).rejects.toThrow()
      await expect(students.markRemoved(classId, id, new Date(), audit)).rejects.toThrow()
      await expect(students.update(classId, id, { fullName: 'Outro' }, audit)).rejects.toThrow()

      expect(await db.selectFrom('students').select(['fullName', 'anonymizedAt', 'removedAt']).where('id', '=', id).executeTakeFirstOrThrow()).toEqual({
        fullName: NAME,
        anonymizedAt: null,
        removedAt: null,
      })
    })
  })

  /** A generated application of Ana with `versions` versions and one sheet for a student of her class. */
  async function printedApplication(versions = 2) {
    const studentId = await addStudent()
    const applicationId = randomUUID()
    await db
      .insertInto('applications')
      .values({ id: applicationId, examId: 'exam-ana', classId, teacherId: 'ana', status: 'generated', pdfUrl: null, date: new Date('2026-10-05T12:00:00.000Z'), gradesReleased: false })
      .execute()
    const versionIds = Array.from({ length: versions }, () => randomUUID())
    await db
      .insertInto('exam_versions')
      .values(
        versionIds.map((versionId, index) => ({
          id: versionId,
          applicationId,
          versionNumber: index + 1,
          shuffleQuestions: false,
          shuffleAlternatives: false,
          withStudentIdentification: true,
          layout: JSON.stringify({ questionOrder: ['q-essay'], alternativeOrder: [] }),
          answerKeyPublished: false,
          publicCode: `PUB-${versionId}`,
          qrCodePayload: `QR-${versionId}`,
        })),
      )
      .execute()
    const sheetId = randomUUID()
    await db
      .insertInto('answer_sheets')
      .values({ id: sheetId, applicationId, examVersionId: versionIds[0] as string, sheetNumber: 1, studentId, code: randomBytes(13).toString('hex').toUpperCase() })
      .execute()
    await db.deleteFrom('activity_logs').execute()
    return { applicationId, versionIds, sheetId, studentId }
  }

  describe('answer keys and grades', () => {
    it('records the publication of one answer key, and not a second publication of the same key', async () => {
      const { applicationId, versionIds } = await printedApplication()
      const path = `/applications/${applicationId}/versions/${versionIds[0]}/publish-answer-key`

      expect((await ana().post(path, { published: true })).status).toBe(204)
      expect((await ana().post(path, { published: true })).status).toBe(204)

      const rows = await trail()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ teacherId: 'ana', type: ACTIVITY_TYPE.ANSWER_KEY_PUBLISHED, entity: AUDIT_ENTITY.EXAM_VERSION, entityId: versionIds[0], details: { applicationId } })
    })

    it('records "publish all" as one entry per key published now', async () => {
      const { applicationId, versionIds } = await printedApplication(3)
      await ana().post(`/applications/${applicationId}/versions/${versionIds[0]}/publish-answer-key`, { published: true })
      await db.deleteFrom('activity_logs').execute()

      await ana().post(`/applications/${applicationId}/publish-answer-keys`)
      await ana().post(`/applications/${applicationId}/publish-answer-keys`)

      const rows = await trail(ACTIVITY_TYPE.ANSWER_KEY_PUBLISHED)
      expect(rows.map((row) => row.entityId).sort()).toEqual([versionIds[1], versionIds[2]].sort())
      expect(rows).toHaveLength(2)
    })

    it('records taking a key back, and writes nothing when the grades are released and the key stays', async () => {
      const { applicationId, versionIds } = await printedApplication(1)
      const keyPath = `/applications/${applicationId}/versions/${versionIds[0]}/publish-answer-key`
      await ana().post(keyPath, { published: true })
      await ana().post(`/applications/${applicationId}/grades-release`, { released: true })
      await db.deleteFrom('activity_logs').execute()

      expect((await ana().post(keyPath, { published: false })).status).toBe(409)
      expect(await trail()).toHaveLength(0)

      await ana().post(`/applications/${applicationId}/grades-release`, { released: false })
      await db.deleteFrom('activity_logs').execute()
      expect((await ana().post(keyPath, { published: false })).status).toBe(204)

      const rows = await trail()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ teacherId: 'ana', type: ACTIVITY_TYPE.ANSWER_KEY_TAKEN_BACK, entityId: versionIds[0] })
    })

    it('records the release and the withdrawal of grades, once each, and nothing for a refused release', async () => {
      const { applicationId, versionIds } = await printedApplication(1)
      const releasePath = `/applications/${applicationId}/grades-release`

      expect((await ana().post(releasePath, { released: true })).status).toBe(409)
      expect(await trail()).toHaveLength(0)

      await ana().post(`/applications/${applicationId}/versions/${versionIds[0]}/publish-answer-key`, { published: true })
      await db.deleteFrom('activity_logs').execute()
      expect((await ana().post(releasePath, { released: true })).status).toBe(200)
      expect((await ana().post(releasePath, { released: true })).status).toBe(200)
      expect((await ana().post(releasePath, { released: false })).status).toBe(200)
      expect((await ana().post(releasePath, { released: false })).status).toBe(200)

      const rows = await trail()
      expect(rows.map((row) => row.type).sort()).toEqual([ACTIVITY_TYPE.GRADES_RELEASED, ACTIVITY_TYPE.GRADES_WITHDRAWN].sort())
      expect(rows.every((row) => row.teacherId === 'ana' && row.entity === AUDIT_ENTITY.APPLICATION && row.entityId === applicationId)).toBe(true)
    })

    it("writes nothing for another teacher's application", async () => {
      const { applicationId, versionIds } = await printedApplication(1)

      expect((await bia().post(`/applications/${applicationId}/versions/${versionIds[0]}/publish-answer-key`, { published: true })).status).toBe(404)
      expect((await bia().post(`/applications/${applicationId}/publish-answer-keys`)).status).toBe(404)
      expect((await bia().post(`/applications/${applicationId}/grades-release`, { released: true })).status).toBe(404)

      expect(await trail()).toHaveLength(0)
    })

    it('does not publish a key when its audit entry cannot be written', async () => {
      const { applicationId, versionIds } = await printedApplication(2)
      const printing = createPrintingRepository(db)

      await expect(printing.publishAnswerKey(UNKNOWN_TEACHER, applicationId, versionIds[0] as string, new Date())).rejects.toThrow()
      await expect(printing.publishAllAnswerKeys(UNKNOWN_TEACHER, applicationId, new Date())).rejects.toThrow()

      const keys = await db.selectFrom('exam_versions').select('answerKeyPublished').where('applicationId', '=', applicationId).execute()
      expect(keys.every((key) => !key.answerKeyPublished)).toBe(true)
    })
  })

  describe('corrections', () => {
    const review = { answers: [], discursiveScores: [{ questionId: 'q-essay', score: 3.5 }], notes: NOTES, finalize: true }

    it('records the confirmation and each edit of a correction without the grade', async () => {
      const { applicationId, sheetId } = await printedApplication(1)

      const created = await ana().post(`/applications/${applicationId}/corrections`, { ...review, answerSheetId: sheetId })
      expect(created.status).toBe(201)
      const edited = await ana().patch(`/applications/${applicationId}/corrections/${created.body.id}`, { discursiveScores: [{ questionId: 'q-essay', score: 1 }], notes: 'novo' })
      expect(edited.status).toBe(200)

      const rows = await trail()
      expect(rows.map((row) => row.type).sort()).toEqual([ACTIVITY_TYPE.CORRECTION_CREATED, ACTIVITY_TYPE.CORRECTION_UPDATED].sort())
      const createdEntry = rows.find((row) => row.type === ACTIVITY_TYPE.CORRECTION_CREATED)
      const editedEntry = rows.find((row) => row.type === ACTIVITY_TYPE.CORRECTION_UPDATED)
      expect(createdEntry).toMatchObject({ teacherId: 'ana', entity: AUDIT_ENTITY.CORRECTION, entityId: created.body.id, details: { applicationId } })
      expect(editedEntry).toMatchObject({ teacherId: 'ana', entityId: created.body.id, details: { applicationId, fields: ['discursiveScores', 'notes'] } })
      await expectNoPersonalData()
    })

    it('writes nothing when the correction is refused', async () => {
      const { applicationId, sheetId } = await printedApplication(1)
      await ana().post(`/applications/${applicationId}/corrections`, { ...review, answerSheetId: sheetId })
      await db.deleteFrom('activity_logs').execute()

      expect((await ana().post(`/applications/${applicationId}/corrections`, { ...review, answerSheetId: sheetId })).status).toBe(409)
      expect((await ana().post(`/applications/${applicationId}/corrections`, { ...review, answerSheetId: sheetId, discursiveScores: [{ questionId: 'q-essay', score: 99 }] })).status).toBe(400)
      expect((await bia().post(`/applications/${applicationId}/corrections`, { ...review, answerSheetId: sheetId })).status).toBe(404)
      expect((await ana().patch(`/applications/${applicationId}/corrections/${randomUUID()}`, { notes: 'x' })).status).toBe(404)

      expect(await trail()).toHaveLength(0)
    })

    it('does not store a correction when its audit entry cannot be written', async () => {
      const { applicationId, sheetId } = await printedApplication(1)
      const created = await ana().post(`/applications/${applicationId}/corrections`, { ...review, answerSheetId: sheetId })
      const stored = (await ana().get(`/applications/${applicationId}/corrections/${created.body.id}`)).body as Correction
      await db.deleteFrom('activity_logs').execute()
      const audit: AuditEntry = { teacherId: UNKNOWN_TEACHER, type: ACTIVITY_TYPE.CORRECTION_UPDATED, entity: AUDIT_ENTITY.CORRECTION, entityId: stored.id }
      const corrections = createCorrectionRepository(db)

      await expect(corrections.update({ ...stored, notes: 'changed' }, audit)).rejects.toThrow()
      await expect(corrections.create({ ...stored, id: randomUUID(), answerSheetId: randomUUID(), clientCorrectionId: randomUUID() }, audit)).rejects.toThrow()

      expect((await ana().get(`/applications/${applicationId}/corrections/${stored.id}`)).body).toEqual(stored)
      expect(await db.selectFrom('corrections').selectAll().execute()).toHaveLength(1)
    })
  })

  describe('append-only', () => {
    it('gives the repository no way to change or remove an entry', () => {
      expect(Object.keys(createActivityLogRepository(db)).sort()).toEqual(['readFailures', 'recordReadFailure'])
    })
  })
})
