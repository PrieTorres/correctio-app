import { randomUUID } from 'node:crypto'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ANSWER_CARD, isAnswerSheetCode, type AnswerSheet, type ExamVersion } from '@correctio/domain'
import type { Express } from 'express'
import type { Insertable, Kysely } from 'kysely'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, DATABASE_TEST_URL, type TestDatabase } from '../../__tests__/test-database'
import { createApp } from '../../app'
import { loadEnv } from '../../config/env'
import { createLocalFileStorage, type FileStorage } from '../../lib/file-storage'
import { createLogger } from '../../lib/logger'
import type { VerifyToken } from '../../middlewares/require-auth'
import type { ApplicationsTable, Database } from '../../models/tables'

const TOKENS: Readonly<Record<string, string>> = { 'token-ana': 'ana', 'token-bia': 'bia' }
const verifyToken: VerifyToken = (token) => {
  const teacherId = TOKENS[token]
  return Promise.resolve(teacherId === undefined ? null : { teacherId })
}

/** Generous budgets: only the last test is about the limit, on an app of its own. */
const RELAXED = { windowMs: 60_000, limit: 10_000 }

const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent' })

const IN_ORDER = { shuffleQuestions: false, shuffleAlternatives: false }
const SHUFFLED = { shuffleQuestions: true, shuffleAlternatives: true }
const TWO_VERSIONS = { versions: [IN_ORDER, SHUFFLED], withStudentIdentification: true }

/** The exam of most tests, in its order: an objective question, one deleted from the bank after it joined, and an essay. */
const EXAM_ORDER = ['q-limits', 'q-old', 'q-essay']

interface GeneratedPaper {
  versions: ExamVersion[]
  sheets: AnswerSheet[]
}

const teacher = (id: string) => ({ id, role: 'professor' as const, fullName: id, email: `${id}@exemplo.edu.br`, passwordHash: 'x' })
const classOf = (id: string, teacherId: string) => ({
  id,
  teacherId,
  name: `Turma ${id}`,
  subject: 'Matemática',
  term: '2026/2',
  status: 'active' as const,
  inviteCode: id.toUpperCase().slice(-8),
})
const examOf = (id: string, teacherId: string) => ({
  id,
  teacherId,
  title: `Prova ${id}`,
  description: '',
  status: 'draft' as const,
  defaultShuffleQuestions: true,
  defaultShuffleAlternatives: true,
})
const studentOf = (id: string, fullName: string, registration: string) => ({ id, classId: 'class-ana', fullName, registration, email: null, userId: null })

/** Noon UTC of the day, which is how the form of the web app stores a date. */
const day = (isoDay: string) => new Date(`${isoDay}T12:00:00.000Z`)

/** The page objects of a PDF, which pdfkit writes uncompressed; `/Type /Pages` is the tree, not a page. */
function pageCount(pdf: Buffer): number {
  return pdf.toString('latin1').match(/\/Type \/Page(?!s)/g)?.length ?? 0
}

describe.runIf(DATABASE_TEST_URL !== undefined)('POST /applications/:id/generate-pdf (real MySQL)', () => {
  let database: TestDatabase
  let db: Kysely<Database>
  let folder: string
  let fileStorage: FileStorage
  let app: Express

  async function insertQuestion(id: string, fields: { statement?: string; alternatives?: readonly string[]; deleted?: boolean } = {}) {
    const { statement = `Enunciado de ${id}`, alternatives, deleted = false } = fields
    const objective = alternatives !== undefined
    await db
      .insertInto('questions')
      .values({
        id,
        teacherId: 'ana',
        type: objective ? 'objetiva' : 'discursiva',
        statement,
        correctAlternativeId: objective ? `${id}-0` : null,
        maxScore: objective ? null : 3,
        deletedAt: deleted ? new Date('2026-10-01T12:00:00.000Z') : null,
        allowShuffleAlternatives: true,
      })
      .execute()
    if (!objective) return
    await db
      .insertInto('question_alternatives')
      .values(alternatives.map((text, position) => ({ questionId: id, id: `${id}-${position}`, text, position })))
      .execute()
  }

  async function insertExam(id: string, questionIds: readonly string[]) {
    await db.insertInto('exams').values(examOf(id, 'ana')).execute()
    if (questionIds.length === 0) return
    await db
      .insertInto('exam_questions')
      .values(questionIds.map((questionId, order) => ({ examId: id, questionId, order, score: order + 1, allowShuffleAlternatives: true })))
      .execute()
  }

  /** Teachers, classes, students, questions and exams exist before any application, for the foreign keys. */
  beforeAll(async () => {
    database = await createTestDatabase()
    db = database.db
    await db.insertInto('users').values([teacher('ana'), teacher('bia')]).execute()
    await db
      .insertInto('classes')
      .values([classOf('class-ana', 'ana'), classOf('class-empty', 'ana'), classOf('class-bia', 'bia')])
      .execute()
    await db
      .insertInto('students')
      .values([
        studentOf('s-bruno', 'Bruno Alves', '2026002'),
        studentOf('s-ana', 'Ana Beatriz', '2026001'),
        studentOf('s-carla', 'Carla Dias', '2026003'),
        { ...studentOf('s-removed', 'Daniel Souza', '2026004'), removedAt: new Date() },
        { ...studentOf('s-anonymized', 'Aluno anonimizado', 'ANON-s-anonym'), anonymizedAt: new Date() },
      ])
      .execute()

    await insertQuestion('q-limits', { alternatives: ['0', '1', 'Não existe', 'Infinito'] })
    await insertQuestion('q-old', { alternatives: ['a', 'b', 'c'], deleted: true })
    await insertQuestion('q-essay')
    await insertQuestion('q-tall', { statement: 'Um enunciado que não termina nunca. '.repeat(300), alternatives: ['Sim', 'Não'] })
    await insertExam('exam-ana', EXAM_ORDER)
    await insertExam('exam-empty', [])
    await insertExam('exam-tall', ['q-limits', 'q-tall'])
    await db.insertInto('exams').values(examOf('exam-bia', 'bia')).execute()

    folder = await mkdtemp(join(tmpdir(), 'correctio-files-'))
    fileStorage = createLocalFileStorage(folder)
    app = createApp({
      env,
      logger: createLogger('silent'),
      db,
      verifyToken,
      fileStorage,
      rateLimits: { read: RELAXED, write: RELAXED, expensive: RELAXED },
    })
  })

  afterAll(async () => {
    await database.drop()
    await rm(folder, { recursive: true, force: true })
  })

  /** Corrections first, then sheets and versions, so no foreign key blocks the delete. */
  beforeEach(async () => {
    await db.deleteFrom('corrections').execute()
    await db.deleteFrom('answer_sheets').execute()
    await db.deleteFrom('exam_versions').execute()
    await db.deleteFrom('applications').execute()
    await db.updateTable('exams').set({ status: 'draft' }).where('teacherId', '=', 'ana').execute()
  })

  function asTeacher(token: string) {
    const authorization = { Authorization: `Bearer ${token}` }
    return {
      get: (path: string) => request(app).get(path).set(authorization),
      generate: (id: string, body: object = TWO_VERSIONS) => request(app).post(`/applications/${id}/generate-pdf`).set(authorization).send(body),
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

  /** A correction of the sheet, still in progress: any correction keeps the paper from being replaced. */
  async function correct(sheet: AnswerSheet) {
    await db
      .insertInto('corrections')
      .values({
        id: randomUUID(),
        examVersionId: sheet.examVersionId,
        studentId: sheet.studentId ?? null,
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

  const storedApplication = (id: string) => db.selectFrom('applications').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  const storedExamStatus = async (id: string) => (await db.selectFrom('exams').select('status').where('id', '=', id).executeTakeFirstOrThrow()).status
  const storedSheetCount = async (applicationId: string) =>
    (await db.selectFrom('answer_sheets').select('id').where('applicationId', '=', applicationId).execute()).length
  const paperOf = (body: unknown) => body as GeneratedPaper
  const messageOf = (body: unknown) => (body as { message: string }).message

  /** The PDFs stored for an application, by file name; none when nothing was ever stored. */
  async function filesOf(applicationId: string): Promise<string[]> {
    return readdir(join(folder, 'applications', applicationId)).catch(() => [])
  }

  it('requires a signed-in teacher', async () => {
    expect((await request(app).post(`/applications/${randomUUID()}/generate-pdf`).send(TWO_VERSIONS)).status).toBe(401)
  })

  it('records the layout of every version and one sheet per student still in the class, by name', async () => {
    const id = await insertApplication()

    const response = await ana().generate(id)

    expect(response.status).toBe(200)
    const { versions, sheets } = paperOf(response.body)
    const [first, second] = versions
    expect(versions.map((version) => [version.versionNumber, version.withStudentIdentification, version.answerKeyPublished])).toEqual([
      [1, true, false],
      [2, true, false],
    ])
    expect(first?.layout).toEqual({
      questionOrder: EXAM_ORDER,
      alternativeOrder: [
        { questionId: 'q-limits', printedOrder: ['q-limits-0', 'q-limits-1', 'q-limits-2', 'q-limits-3'] },
        { questionId: 'q-old', printedOrder: ['q-old-0', 'q-old-1', 'q-old-2'] },
      ],
    })
    expect(sheets.map((sheet) => [sheet.sheetNumber, sheet.studentId, sheet.examVersionId])).toEqual([
      [1, 's-ana', first?.id],
      [2, 's-bruno', second?.id],
      [3, 's-carla', first?.id],
    ])
  })

  /** RF22: the request says how each version shuffles, and each version keeps what it was asked. */
  it('shuffles each version as the request says, and stores the paper it answers', async () => {
    const id = await insertApplication()

    const { versions, sheets } = paperOf((await ana().generate(id)).body)

    expect(versions.map(({ shuffleQuestions, shuffleAlternatives }) => ({ shuffleQuestions, shuffleAlternatives }))).toEqual([IN_ORDER, SHUFFLED])
    expect(versions[1]?.layout.questionOrder.toSorted()).toEqual(EXAM_ORDER.toSorted())
    expect((await ana().get(`/applications/${id}/versions`)).body).toEqual({ total: 2, items: versions })
    expect((await ana().get(`/applications/${id}/sheets`)).body).toEqual({ total: 3, items: sheets })
  })

  /** The question was deleted from the bank after it joined the exam: without its alternatives, its row could never be read. */
  it('prints a question deleted from the bank, with its alternatives, in every version', async () => {
    const id = await insertApplication()

    const { versions } = paperOf((await ana().generate(id)).body)

    for (const { layout } of versions) {
      expect(layout.alternativeOrder.find((entry) => entry.questionId === 'q-old')?.printedOrder.toSorted()).toEqual(['q-old-0', 'q-old-1', 'q-old-2'])
    }
  })

  /** The code is the only key of the public lookup, so it is made here, never sent by a client (`docs/Seguranca_e_LGPD.md`, section 3). */
  it('gives every sheet a code of its own made on the server, and the geometry of the card it is printed with', async () => {
    const id = await insertApplication()

    const { sheets } = paperOf((await ana().generate(id, { ...TWO_VERSIONS, code: 'AAAAAAAAAAAAAAAAAAAAAAAAAA' })).body)

    expect(sheets.every((sheet) => isAnswerSheetCode(sheet.code) && sheet.answerCardVersion === ANSWER_CARD.version)).toBe(true)
    expect(new Set(sheets.map((sheet) => sheet.code)).size).toBe(3)
    expect(sheets.map((sheet) => sheet.code)).not.toContain('AAAAAAAAAAAAAAAAAAAAAAAAAA')
  })

  it('ties no sheet to a student when the application does not identify them', async () => {
    const id = await insertApplication()

    const { versions, sheets } = paperOf((await ana().generate(id, { ...TWO_VERSIONS, withStudentIdentification: false })).body)

    expect(versions.every((version) => !version.withStudentIdentification)).toBe(true)
    expect(sheets.map((sheet) => [sheet.sheetNumber, sheet.studentId])).toEqual([
      [1, undefined],
      [2, undefined],
      [3, undefined],
    ])
  })

  it('marks the application generated and the exam ready, and serves the PDF it printed for real', async () => {
    const id = await insertApplication()

    await ana().generate(id)

    const application = (await ana().get(`/applications/${id}`)).body as { status: string; pdfUrl: string }
    expect(application).toMatchObject({ status: 'generated', pdfUrl: `/applications/${id}/pdf` })
    expect(await storedExamStatus('exam-ana')).toBe('ready')

    const pdf = await ana().get(`/applications/${id}/pdf`).responseType('blob')
    expect(pdf.status).toBe(200)
    expect(pdf.headers['content-type']).toBe('application/pdf')
    const content = pdf.body as Buffer
    expect(content.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pageCount(content)).toBe(6)
  })

  /** RF20: archiving an exam blocks new applications without affecting the existing ones. */
  it('still prints an application whose exam was archived afterwards, leaving the exam archived', async () => {
    const id = await insertApplication()
    await db.updateTable('exams').set({ status: 'closed' }).where('id', '=', 'exam-ana').execute()

    expect((await ana().generate(id)).status).toBe(200)
    expect(await storedExamStatus('exam-ana')).toBe('closed')
  })

  /** RF24: a sheet printed before keeps nothing, so a stray copy of the old paper finds no grade. */
  it('replaces the versions, the sheets and the PDF when generated again, and the old codes and file are gone', async () => {
    const id = await insertApplication()
    const first = paperOf((await ana().generate(id)).body)
    const firstKey = (await storedApplication(id)).pdfUrl ?? ''

    const response = await ana().generate(id, { versions: [IN_ORDER], withStudentIdentification: true })

    expect(response.status).toBe(200)
    const { versions, sheets } = paperOf(response.body)
    expect(versions).toHaveLength(1)
    const oldCodes = first.sheets.map((sheet) => sheet.code)
    expect(await db.selectFrom('answer_sheets').select('id').where('code', 'in', oldCodes).execute()).toEqual([])
    expect(sheets.every((sheet) => sheet.examVersionId === versions[0]?.id)).toBe(true)
    expect(await fileStorage.read(firstKey)).toBeNull()
    expect(await filesOf(id)).toHaveLength(1)
    expect((await ana().get(`/applications/${id}/pdf`).responseType('blob')).status).toBe(200)
  })

  it('refuses to generate again once a sheet was corrected, changing nothing (RF24)', async () => {
    const id = await insertApplication()
    const { sheets } = paperOf((await ana().generate(id)).body)
    await correct(sheets[0] as AnswerSheet)
    const files = await filesOf(id)

    const response = await ana().generate(id)

    expect(response.status).toBe(409)
    expect(messageOf(response.body)).toBe(
      'Uma folha desta aplicação já foi corrigida. Gerar de novo trocaria as versões e as correções deixariam de bater com a prova impressa.',
    )
    expect((await ana().get(`/applications/${id}/sheets`)).body).toEqual({ total: 3, items: sheets })
    expect(await filesOf(id)).toEqual(files)
  })

  /** The new versions would be born with their key unpublished, and a grade never shows without it (RF46). */
  it('refuses while the grades are released, asking to take them back first', async () => {
    const id = await insertApplication({ status: 'generated', gradesReleased: true })

    const response = await ana().generate(id)

    expect([response.status, messageOf(response.body)]).toEqual([409, 'As notas desta aplicação estão liberadas. Recolha as notas antes de gerar de novo.'])
  })

  it('refuses an archived application until it is restored', async () => {
    const id = await insertApplication({ status: 'closed' })

    const response = await ana().generate(id)

    expect([response.status, messageOf(response.body)]).toEqual([409, 'Esta aplicação está arquivada. Restaure antes de gerar.'])
  })

  it('says what is missing when the exam has no question or the class has no student to hand a sheet to', async () => {
    const noQuestion = await insertApplication({ examId: 'exam-empty' })
    const noStudent = await insertApplication({ classId: 'class-empty' })

    const [withoutQuestions, withoutStudents] = await Promise.all([ana().generate(noQuestion), ana().generate(noStudent)])

    expect([withoutQuestions.status, messageOf(withoutQuestions.body)]).toEqual([409, 'A prova não tem questões. Monte a prova antes de gerar.'])
    expect([withoutStudents.status, messageOf(withoutStudents.body)]).toEqual([
      409,
      'A turma não tem alunos ativos para receber as folhas. Cadastre os alunos antes de gerar.',
    ])
    expect([...(await filesOf(noQuestion)), ...(await filesOf(noStudent))]).toEqual([])
  })

  /** Printed anyway, the statement would be cut and the sheet would end on a page the plan never counted (RF44). */
  it('names a question too tall for a page by its place in the exam, and stores nothing', async () => {
    const id = await insertApplication({ examId: 'exam-tall' })

    const response = await ana().generate(id)

    expect([response.status, messageOf(response.body)]).toEqual([
      409,
      'A questão 2 da prova não cabe numa página impressa. Encurte o enunciado ou divida a questão em duas.',
    ])
    expect(await storedApplication(id)).toMatchObject({ status: 'draft', pdfUrl: null })
    expect(await storedSheetCount(id)).toBe(0)
    expect(await filesOf(id)).toEqual([])
  })

  it('refuses a body that does not say how to generate, in words the screen can show', async () => {
    const id = await insertApplication()

    const responses = await Promise.all([
      ana().generate(id, { versions: [], withStudentIdentification: true }),
      ana().generate(id, { versions: Array.from({ length: 7 }, () => IN_ORDER), withStudentIdentification: true }),
      ana().generate(id, { versions: [IN_ORDER] }),
    ])

    expect(responses.map((response) => [response.status, messageOf(response.body)])).toEqual([
      [400, 'Gere pelo menos uma versão'],
      [400, 'Máximo de 6 versões por aplicação'],
      [400, 'Informe se as folhas saem com o nome do aluno'],
    ])
    expect(await storedSheetCount(id)).toBe(0)
  })

  it('answers 404, never 403, to another teacher, generating nothing', async () => {
    const id = await insertApplication()

    const response = await bia().generate(id)

    expect([response.status, messageOf(response.body)]).toEqual([404, 'Aplicação não encontrada.'])
    expect(await storedSheetCount(id)).toBe(0)
    expect(await filesOf(id)).toEqual([])
  })

  /**
   * Two clicks on "Gerar": both draw a PDF, and the swaps take turns on the
   * lock of the application. The second replaces the first and removes its
   * PDF, so one paper is left, whole, with the file it points at.
   */
  it('leaves one whole paper and one file when two generations arrive together', async () => {
    const id = await insertApplication()

    const responses = await Promise.all([ana().generate(id), ana().generate(id, { versions: [IN_ORDER], withStudentIdentification: true })])

    expect(responses.map((response) => response.status)).toEqual([200, 200])
    const versions = await db.selectFrom('exam_versions').select('id').where('applicationId', '=', id).execute()
    expect([1, 2]).toContain(versions.length)
    expect(await storedSheetCount(id)).toBe(3)
    const [file] = await filesOf(id)
    expect(await filesOf(id)).toHaveLength(1)
    expect((await storedApplication(id)).pdfUrl).toBe(`applications/${id}/${file}`)
  })

  /** `docs/Seguranca_e_LGPD.md`, section 4: generating is the expensive tier, ten an hour per teacher. */
  it('counts against the expensive limit of the teacher', async () => {
    const limited = createApp({
      env,
      logger: createLogger('silent'),
      db,
      verifyToken,
      fileStorage,
      rateLimits: { read: RELAXED, write: RELAXED, expensive: { windowMs: 60_000, limit: 2 } },
    })
    const id = await insertApplication()
    const generate = () => request(limited).post(`/applications/${id}/generate-pdf`).set({ Authorization: 'Bearer token-ana' }).send(TWO_VERSIONS)

    const statuses = [(await generate()).status, (await generate()).status, (await generate()).status]

    expect(statuses).toEqual([200, 200, 429])
  })
})
