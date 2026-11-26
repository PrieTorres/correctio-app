import { randomBytes, randomUUID } from 'node:crypto'
import type { ExamVersionLayout } from '@correctio/domain'
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
import type { MailMessage, Mailer } from '../../services/mailer'

const TOKENS: Readonly<Record<string, string>> = { 'token-ana': 'ana', 'token-bia': 'bia' }
const verifyToken: VerifyToken = (token) => {
  const teacherId = TOKENS[token]
  return Promise.resolve(teacherId === undefined ? null : { teacherId })
}

const RELAXED = { windowMs: 60_000, limit: 10_000 }
const PUBLIC_APP_URL = 'https://correctio.example'
const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', PUBLIC_APP_URL })
const cipher = createFieldCipher(randomBytes(32).toString('base64'))

const LAYOUT: ExamVersionLayout = { questionOrder: [], alternativeOrder: [] }
const GRADE_OF_THE_STUDENT = 7.25

const EMPTY_SUMMARY = { sent: 0, failed: 0, skipped: { noEmail: 0, anonymized: 0, removed: 0, noSheet: 0 } }

/** Keeps every message instead of sending it; an address in `refuse` fails the way a mail server refusing it would. */
function fakeMailer(refuse: readonly string[] = []) {
  const sent: MailMessage[] = []
  const mailer: Mailer = {
    send(message) {
      if (refuse.includes(message.to)) return Promise.reject(new Error(`550 mailbox ${message.to} unavailable`))
      sent.push(message)
      return Promise.resolve()
    },
  }
  return { sent, mailer }
}

describe.runIf(DATABASE_TEST_URL !== undefined)('POST /applications/:id/grade-links (real MySQL)', () => {
  let database: TestDatabase
  let db: Kysely<Database>
  let mail = fakeMailer()

  const appWith = (mailer: Mailer, rateLimits = {}): Express =>
    createApp({
      env,
      logger: createLogger('silent'),
      db,
      verifyToken,
      fieldCipher: cipher,
      mailer,
      rateLimits: { read: RELAXED, write: RELAXED, ...rateLimits },
    })

  const send = (token: string, id: string, app: Express = appWith(mail.mailer)) =>
    request(app).post(`/applications/${id}/grade-links`).set({ Authorization: `Bearer ${token}` })

  beforeAll(async () => {
    database = await createTestDatabase()
    db = database.db
    const teacher = (id: string) => ({ id, role: 'professor' as const, fullName: id, email: `${id}@exemplo.edu.br`, passwordHash: 'x' })
    await db.insertInto('users').values([teacher('ana'), teacher('bia')]).execute()
    await db
      .insertInto('classes')
      .values([
        { id: 'class-ana', teacherId: 'ana', name: 'Turma 9A', subject: 'Matemática', term: '2026/2', status: 'active', inviteCode: 'ANA00001' },
        { id: 'class-other', teacherId: 'ana', name: 'Turma 9B', subject: 'Matemática', term: '2026/2', status: 'active', inviteCode: 'ANA00002' },
      ])
      .execute()
    await db
      .insertInto('exams')
      .values({ id: 'exam-ana', teacherId: 'ana', title: 'Prova de Limites', description: '', status: 'ready', defaultShuffleQuestions: true, defaultShuffleAlternatives: true })
      .execute()
  })

  afterAll(async () => {
    await database.drop()
  })

  beforeEach(async () => {
    mail = fakeMailer()
    await db.deleteFrom('corrections').execute()
    await db.deleteFrom('answer_sheets').execute()
    await db.deleteFrom('exam_versions').execute()
    await db.deleteFrom('applications').execute()
    await db.deleteFrom('students').execute()
  })

  async function insertApplication(fields: { gradesReleased?: boolean; status?: 'draft' | 'generated' | 'closed' } = {}) {
    const id = randomUUID()
    await db
      .insertInto('applications')
      .values({ id, examId: 'exam-ana', classId: 'class-ana', teacherId: 'ana', status: 'generated', pdfUrl: null, date: new Date('2026-10-05T12:00:00Z'), gradesReleased: true, ...fields })
      .execute()
    const versionId = randomUUID()
    await db
      .insertInto('exam_versions')
      .values({
        id: versionId,
        applicationId: id,
        versionNumber: 1,
        shuffleQuestions: false,
        shuffleAlternatives: false,
        withStudentIdentification: true,
        layout: JSON.stringify(LAYOUT),
        answerKeyPublished: true,
        publicCode: `PUB-${id}`,
        qrCodePayload: `QR-${id}`,
      })
      .execute()
    return { id, versionId }
  }

  async function insertStudent(fields: { id: string; fullName: string; email?: string; anonymized?: boolean; removed?: boolean; classId?: string }) {
    await db
      .insertInto('students')
      .values({
        id: fields.id,
        classId: fields.classId ?? 'class-ana',
        fullName: fields.fullName,
        registration: fields.id,
        email: fields.email === undefined ? null : cipher.encrypt(fields.email),
        anonymizedAt: fields.anonymized === true ? new Date() : null,
        removedAt: fields.removed === true ? new Date() : null,
        userId: null,
      })
      .execute()
  }

  async function insertSheet(application: { id: string; versionId: string }, sheetNumber: number, code: string, studentId: string | null) {
    const id = randomUUID()
    await db.insertInto('answer_sheets').values({ id, applicationId: application.id, examVersionId: application.versionId, studentId, sheetNumber, code }).execute()
    return id
  }

  async function insertCorrection(application: { versionId: string }, answerSheetId: string, studentId: string | null) {
    await db
      .insertInto('corrections')
      .values({
        id: randomUUID(),
        examVersionId: application.versionId,
        studentId,
        reportedStudentName: null,
        reportedStudentRegistration: null,
        totalScore: GRADE_OF_THE_STUDENT,
        notes: null,
        confirmedAt: new Date(),
        correctedBy: 'ana',
        isAutomaticallyAssigned: false,
        clientCorrectionId: randomUUID(),
        syncStatus: 'synced',
        answerSheetId,
        source: 'MANUAL',
        status: 'DONE',
        imageUrl: null,
      })
      .execute()
  }

  it('requires a signed-in teacher', async () => {
    const response = await request(appWith(mail.mailer)).post(`/applications/${randomUUID()}/grade-links`)

    expect(response.status).toBe(401)
  })

  it('sends nothing before the grades are released, and says so', async () => {
    const application = await insertApplication({ gradesReleased: false })
    await insertStudent({ id: 'ana-lima', fullName: 'Ana Lima', email: 'ana.lima@aluno.edu.br' })
    await insertSheet(application, 1, 'CODE1', 'ana-lima')

    const response = await send('token-ana', application.id)

    expect([response.status, response.body]).toEqual([409, { code: 'conflict', message: 'Libere as notas antes de enviar o link da consulta aos alunos.' }])
    expect(mail.sent).toEqual([])
  })

  it('sends nothing for an archived application, whose public page no longer opens', async () => {
    const application = await insertApplication({ status: 'closed' })
    await insertStudent({ id: 'ana-lima', fullName: 'Ana Lima', email: 'ana.lima@aluno.edu.br' })
    await insertSheet(application, 1, 'CODE1', 'ana-lima')

    const response = await send('token-ana', application.id)

    expect(response.status).toBe(409)
    expect(mail.sent).toEqual([])
  })

  it('answers 404, never 403, to another teacher, and sends nothing', async () => {
    const application = await insertApplication()
    await insertStudent({ id: 'ana-lima', fullName: 'Ana Lima', email: 'ana.lima@aluno.edu.br' })
    await insertSheet(application, 1, 'CODE1', 'ana-lima')

    const fromBia = await send('token-bia', application.id)
    const unknown = await send('token-ana', randomUUID())

    expect([fromBia.status, unknown.status]).toEqual([404, 404])
    expect(mail.sent).toEqual([])
  })

  it('sends one e-mail per reachable student with the link of their own sheet and counts who was left out', async () => {
    const application = await insertApplication()
    await insertStudent({ id: 'ana-lima', fullName: 'Ana Lima', email: 'ana.lima@aluno.edu.br' })
    await insertStudent({ id: 'bruno', fullName: 'Bruno Costa', email: 'bruno@aluno.edu.br' })
    await insertStudent({ id: 'carla', fullName: 'Carla Dias' })
    await insertStudent({ id: 'diego', fullName: 'Diego Reis', email: 'diego@aluno.edu.br', anonymized: true })
    await insertStudent({ id: 'elisa', fullName: 'Elisa Prado', email: 'elisa@aluno.edu.br', removed: true })
    await insertStudent({ id: 'fabio', fullName: 'Fábio Neri', email: 'fabio@aluno.edu.br' })
    await insertStudent({ id: 'other-class', fullName: 'Outra Turma', email: 'outra@aluno.edu.br', classId: 'class-other' })
    const anaSheet = await insertSheet(application, 1, 'CODEANA', 'ana-lima')
    await insertCorrection(application, anaSheet, 'ana-lima')
    const brunoSheet = await insertSheet(application, 2, 'CODEBRUNO', null)
    await insertCorrection(application, brunoSheet, 'bruno')
    await insertSheet(application, 3, 'CODECARLA', 'carla')
    await insertSheet(application, 4, 'CODEDIEGO', 'diego')
    await insertSheet(application, 5, 'CODEELISA', 'elisa')
    await insertSheet(application, 6, 'CODEOTHER', 'other-class')

    const response = await send('token-ana', application.id)

    expect([response.status, response.body]).toEqual([
      200,
      { sent: 2, failed: 0, skipped: { noEmail: 1, anonymized: 1, removed: 1, noSheet: 1 } },
    ])
    expect(mail.sent.map((message) => [message.to, message.text.includes(`${PUBLIC_APP_URL}/r/`)])).toEqual([
      ['ana.lima@aluno.edu.br', true],
      ['bruno@aluno.edu.br', true],
    ])
    expect(mail.sent[0]?.text).toContain(`${PUBLIC_APP_URL}/r/CODEANA`)
    expect(mail.sent[0]?.html).toContain(`href="${PUBLIC_APP_URL}/r/CODEANA"`)
    expect(mail.sent[1]?.text).toContain(`${PUBLIC_APP_URL}/r/CODEBRUNO`)
  })

  it('names the exam and the class, and carries neither the grade nor any other student', async () => {
    const application = await insertApplication()
    await insertStudent({ id: 'ana-lima', fullName: 'Ana Lima', email: 'ana.lima@aluno.edu.br' })
    await insertStudent({ id: 'bruno', fullName: 'Bruno Costa', email: 'bruno@aluno.edu.br' })
    const anaSheet = await insertSheet(application, 1, 'CODEANA', 'ana-lima')
    await insertCorrection(application, anaSheet, 'ana-lima')
    await insertSheet(application, 2, 'CODEBRUNO', 'bruno')

    await send('token-ana', application.id)

    const [first] = mail.sent
    expect(first?.text).toContain('Prova de Limites')
    expect(first?.text).toContain('Turma 9A')
    expect(first?.text).toContain('Olá, Ana!')
    for (const part of [first?.text, first?.html, first?.subject]) {
      expect(part).not.toMatch(/7[.,]25/)
      expect(part).not.toContain('CODEBRUNO')
      expect(part).not.toContain('bruno@')
    }
    expect(mail.sent.every((message) => message.confidential === true)).toBe(true)
  })

  it('goes on after a send fails and counts it as failed', async () => {
    const application = await insertApplication()
    await insertStudent({ id: 'ana-lima', fullName: 'Ana Lima', email: 'ana.lima@aluno.edu.br' })
    await insertStudent({ id: 'bruno', fullName: 'Bruno Costa', email: 'bruno@aluno.edu.br' })
    await insertStudent({ id: 'carla', fullName: 'Carla Dias', email: 'carla@aluno.edu.br' })
    await insertSheet(application, 1, 'CODEANA', 'ana-lima')
    await insertSheet(application, 2, 'CODEBRUNO', 'bruno')
    await insertSheet(application, 3, 'CODECARLA', 'carla')
    const refusing = fakeMailer(['bruno@aluno.edu.br'])

    const response = await send('token-ana', application.id, appWith(refusing.mailer))

    expect([response.status, response.body]).toEqual([200, { ...EMPTY_SUMMARY, sent: 2, failed: 1 }])
    expect(refusing.sent.map((message) => message.to)).toEqual(['ana.lima@aluno.edu.br', 'carla@aluno.edu.br'])
    expect(JSON.stringify(response.body)).not.toContain('bruno')
  })

  it('stays under the expensive rate-limit tier', async () => {
    const application = await insertApplication()
    const app = appWith(mail.mailer, { expensive: { windowMs: 60_000, limit: 1 } })

    const first = await send('token-ana', application.id, app)
    const second = await send('token-ana', application.id, app)

    expect([first.status, second.status]).toEqual([200, 429])
  })

  it('reports an empty class as nothing sent, not as an error', async () => {
    const application = await insertApplication()

    const response = await send('token-ana', application.id)

    expect([response.status, response.body]).toEqual([200, EMPTY_SUMMARY])
  })
})
