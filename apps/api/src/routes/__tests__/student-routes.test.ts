import { randomBytes } from 'node:crypto'
import type { Student } from '@correctio/domain'
import type { Express } from 'express'
import type { Kysely } from 'kysely'
import request, { type Response } from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, DATABASE_TEST_URL, type TestDatabase } from '../../__tests__/test-database'
import { createApp, type AppDependencies } from '../../app'
import { loadEnv } from '../../config/env'
import { createFieldCipher } from '../../lib/field-encryption'
import { createLogger } from '../../lib/logger'
import type { VerifyToken } from '../../middlewares/require-auth'
import type { Database } from '../../models/tables'

const TOKENS: Readonly<Record<string, string>> = { 'token-ana': 'ana', 'token-bia': 'bia' }
const verifyToken: VerifyToken = (token) => {
  const teacherId = TOKENS[token]
  return Promise.resolve(teacherId === undefined ? null : { teacherId })
}

const RELAXED = { windowMs: 60_000, limit: 10_000 }

const ANA = { fullName: 'Ana Beatriz', registration: '2026001', email: 'ana@exemplo.edu.br' }

const user = (id: string, role: 'professor' | 'estudante' = 'professor') => ({
  id,
  role,
  fullName: id,
  email: `${id}@exemplo.edu.br`,
  passwordHash: 'x',
})
const itemsIn = (response: Response) => (response.body as { items: Student[] }).items
const namesIn = (response: Response) => itemsIn(response).map((student) => student.fullName)

describe.runIf(DATABASE_TEST_URL !== undefined)('student routes (real MySQL)', () => {
  let database: TestDatabase
  let db: Kysely<Database>
  let dependencies: AppDependencies
  let app: Express
  let classId: string
  let otherClassId: string

  /** `conta-aluno` is the account a student area would link through `Student.userId`, a column no route writes. */
  beforeAll(async () => {
    database = await createTestDatabase()
    db = database.db
    await db.insertInto('users').values([user('ana'), user('bia'), user('conta-aluno', 'estudante')]).execute()

    dependencies = {
      env: loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }),
      logger: createLogger('silent'),
      db,
      verifyToken,
      fieldCipher: createFieldCipher(randomBytes(32).toString('base64')),
      rateLimits: { read: RELAXED, write: RELAXED, expensive: RELAXED },
    }
    app = createApp(dependencies)
  })

  afterAll(() => database.drop())

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

  /** Two classes of the same teacher, so a student can be reached through the wrong one. */
  beforeEach(async () => {
    await db.deleteFrom('students').execute()
    await db.deleteFrom('classes').execute()
    classId = (await ana().post('/classes', { name: 'Cálculo I', subject: 'Matemática', term: '2026/2' })).body.id
    otherClassId = (await ana().post('/classes', { name: 'Física II', subject: 'Física', term: '2026/2' })).body.id
  })

  const studentsOf = (id = classId) => `/classes/${id}/students`
  const studentPath = (studentId: string, id = classId) => `${studentsOf(id)}/${studentId}`
  const importRows = (rows: object[], id = classId) => ana().post(`${studentsOf(id)}/import`, { rows })
  const storedStudent = (id: string) => db.selectFrom('students').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  const listedNames = async (id = classId) => namesIn(await ana().get(studentsOf(id)))

  async function add(body: object = ANA, id = classId): Promise<Student> {
    const response = await ana().post(studentsOf(id), body)
    expect(response.status).toBe(201)
    return response.body as Student
  }

  describe('POST /classes/:id/students', () => {
    it('adds a student to the class, answering with the fields of the contract', async () => {
      const response = await ana().post(studentsOf(), ANA)

      expect(response.status).toBe(201)
      expect(response.body).toEqual({ id: expect.any(String), classId, ...ANA })
    })

    it('stores the e-mail encrypted, and gives the address back only through the API', async () => {
      const student = await add()
      const stored = await storedStudent(student.id)

      expect(stored.email).toMatch(/^v1\./)
      expect(stored.email).not.toContain('ana@exemplo')
      expect(itemsIn(await ana().get(studentsOf()))[0]?.email).toBe('ana@exemplo.edu.br')
    })

    it('leaves the e-mail out when it was left blank', async () => {
      const response = await ana().post(studentsOf(), { ...ANA, email: '' })
      const student = response.body as Student

      expect(student).not.toHaveProperty('email')
      expect((await storedStudent(student.id)).email).toBeNull()
    })

    it('refuses an invalid student with the message the form shows', async () => {
      const response = await ana().post(studentsOf(), { ...ANA, email: 'ana@' })

      expect(response.status).toBe(400)
      expect(response.body).toEqual({ code: 'invalid', message: 'E-mail inválido' })
    })

    it('refuses a registration already in the class, and accepts it in another class', async () => {
      await add()
      const again = await ana().post(studentsOf(), { ...ANA, fullName: 'Outra Ana' })

      expect(again.status).toBe(409)
      expect(again.body).toEqual({ code: 'conflict', message: 'A matrícula 2026001 já existe nesta turma.' })
      expect((await ana().post(studentsOf(otherClassId), ANA)).status).toBe(201)
    })

    it('compares registrations as the unique index does, without case or accents', async () => {
      await add({ ...ANA, registration: 'MAT-A1' })

      expect((await ana().post(studentsOf(), { ...ANA, registration: 'mat-a1' })).status).toBe(409)
    })
  })

  describe('GET /classes/:id/students', () => {
    it('lists the students of the class by name, with the total', async () => {
      await add({ fullName: 'Carla Dias', registration: '3' })
      await add({ fullName: 'Ana Beatriz', registration: '1' })
      await add({ fullName: 'Bruno Lima', registration: '2' }, otherClassId)
      const response = await ana().get(studentsOf())

      expect(response.status).toBe(200)
      expect(response.body.total).toBe(2)
      expect(namesIn(response)).toEqual(['Ana Beatriz', 'Carla Dias'])
    })

    it('finds by name or registration', async () => {
      await add({ fullName: 'Ana Beatriz', registration: '2026001' })
      await add({ fullName: 'Bruno Lima', registration: '2026002' })

      expect(namesIn(await ana().get(studentsOf()).query({ search: 'beatriz' }))).toEqual(['Ana Beatriz'])
      expect(namesIn(await ana().get(studentsOf()).query({ search: '002' }))).toEqual(['Bruno Lima'])
    })

    /** The sheets and grades of an application name everyone who sat it, the removed included (RF09, #161). */
    it('adds the removed students when asked, marked by removedAt', async () => {
      const removed = await add({ fullName: 'Aluno Alfa Um', registration: '1001' })
      await add({ fullName: 'Bruno Lima', registration: '1002' })
      await ana().delete(studentPath(removed.id))

      const everyone = await ana().get(studentsOf()).query({ includeRemoved: 'true' })

      expect(everyone.body.total).toBe(2)
      expect(namesIn(everyone)).toEqual(['Aluno Alfa Um', 'Bruno Lima'])
      expect(itemsIn(everyone)[0]?.removedAt).toEqual(expect.any(String))
      expect(await listedNames()).toEqual(['Bruno Lima'])
      expect(namesIn(await ana().get(studentsOf()).query({ includeRemoved: 'false' }))).toEqual(['Bruno Lima'])
    })

    /** RF38 outlives the removal: the list never brings back the name anonymization erased. */
    it('lists a removed student who was anonymized under the anonymized name only', async () => {
      const removed = await add()
      await ana().delete(studentPath(removed.id))
      await ana().post(`${studentPath(removed.id)}/anonymize`)

      expect(namesIn(await ana().get(studentsOf()).query({ includeRemoved: 'true' }))).toEqual(['Aluno anonimizado'])
    })

    it('refuses an includeRemoved that is not true or false', async () => {
      const response = await ana().get(studentsOf()).query({ includeRemoved: 'yes' })

      expect(response.status).toBe(400)
      expect(response.body).toEqual({ code: 'invalid', message: 'Parâmetro de lista inválido: includeRemoved.' })
    })
  })

  describe('POST /classes/:id/students/import', () => {
    it('writes the new rows and counts those already in the class or repeated in the list', async () => {
      await add({ fullName: 'Ana', registration: '1' })
      const response = await importRows([
        { fullName: 'Ana de novo', registration: '1' },
        { fullName: 'Bruno', registration: '2', email: 'bruno@exemplo.edu.br' },
        { fullName: 'Carla', registration: '3' },
        { fullName: 'Bruno repetido', registration: '2' },
      ])

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ created: 2, skipped: 2 })
      expect(await listedNames()).toEqual(['Ana', 'Bruno', 'Carla'])
    })

    it('encrypts every imported e-mail', async () => {
      await importRows([{ fullName: 'Bruno', registration: '2', email: 'bruno@exemplo.edu.br' }])
      const [bruno] = itemsIn(await ana().get(studentsOf()))

      expect(bruno?.email).toBe('bruno@exemplo.edu.br')
      expect((await storedStudent(bruno?.id ?? '')).email).toMatch(/^v1\./)
    })

    it('skips a registration the unique index sees as the same, such as one in another case', async () => {
      await add({ fullName: 'Ana', registration: 'A1' })

      expect((await importRows([{ fullName: 'Ana', registration: 'a1' }])).body).toEqual({ created: 0, skipped: 1 })
    })

    it('refuses the whole list when a row is invalid, naming the row with the message the form shows', async () => {
      const response = await importRows([
        { fullName: 'Ana', registration: '1' },
        { fullName: '', registration: '2' },
      ])

      expect(response.status).toBe(400)
      expect(response.body.message).toBe('Linha 2 da importação: Informe o nome do aluno. Nada foi importado.')
      expect(await listedNames()).toEqual([])
    })

    it('refuses a row that is not a student at all', async () => {
      const response = await importRows([{ fullName: 'Ana', registration: '1' }, ['Bruno', '2']])

      expect(response.status).toBe(400)
      expect(response.body.message).toMatch(/^Linha 2 da importação: .+\. Nada foi importado\.$/)
    })

    it('refuses an import without rows, saying what to send', async () => {
      const empty = await importRows([])
      const withoutRows = await ana().post(`${studentsOf()}/import`, {})

      expect(empty.body).toEqual({ code: 'invalid', message: 'Envie ao menos um aluno para importar' })
      expect(withoutRows.body).toEqual({ code: 'invalid', message: 'Envie ao menos um aluno para importar' })
    })

    /**
     * MySQL compares `ß` and `ss` as equal, and the comparison made before
     * writing does not: the index still refuses the row, and the single
     * statement leaves the other row of the list unwritten too.
     */
    it('writes nothing when the index refuses a registration the earlier check let through', async () => {
      await add({ fullName: 'Ana', registration: 'ss1' })
      const response = await importRows([
        { fullName: 'Bruno', registration: 'b1' },
        { fullName: 'Ana', registration: 'ß1' },
      ])

      expect(response.status).toBe(409)
      expect(response.body.code).toBe('conflict')
      expect(await listedNames()).toEqual(['Ana'])
    })

    it('counts against the expensive tier, per teacher', async () => {
      const limited = createApp({ ...dependencies, rateLimits: { ...dependencies.rateLimits, expensive: { windowMs: 60_000, limit: 1 } } })
      const importOnce = () =>
        request(limited)
          .post(`${studentsOf()}/import`)
          .set('Authorization', 'Bearer token-ana')
          .send({ rows: [{ fullName: 'Ana', registration: '1' }] })

      expect((await importOnce()).status).toBe(200)
      expect((await importOnce()).status).toBe(429)
    })
  })

  describe('PATCH /classes/:id/students/:studentId', () => {
    it('changes only what was sent and keeps the rest', async () => {
      const student = await add()
      const response = await ana().patch(studentPath(student.id), { fullName: 'Ana Beatriz Moreira' })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ ...student, fullName: 'Ana Beatriz Moreira' })
    })

    it('removes the e-mail sent as null', async () => {
      const student = await add()
      const response = await ana().patch(studentPath(student.id), { email: null })

      expect(response.body).not.toHaveProperty('email')
      expect((await storedStudent(student.id)).email).toBeNull()
    })

    it('keeps userId and every other column outside the form', async () => {
      const student = await add()
      await db.updateTable('students').set({ userId: 'conta-aluno' }).where('id', '=', student.id).execute()
      const response = await ana().patch(studentPath(student.id), { fullName: 'Ana B.', userId: null })

      expect(response.body).toEqual({ ...student, fullName: 'Ana B.', userId: 'conta-aluno' })
      expect((await storedStudent(student.id)).userId).toBe('conta-aluno')
    })

    it('writes nothing when the body carries nothing of the form', async () => {
      const student = await add()
      const before = await storedStudent(student.id)
      const response = await ana().patch(studentPath(student.id), { removedAt: null, classId: otherClassId })

      expect(response.body).toEqual(student)
      expect(await storedStudent(student.id)).toEqual(before)
    })

    it('refuses a registration that another student of the class holds', async () => {
      await add()
      const bruno = await add({ fullName: 'Bruno Lima', registration: '2026002' })
      const response = await ana().patch(studentPath(bruno.id), { registration: '2026001' })

      expect(response.status).toBe(409)
      expect(response.body.message).toBe('A matrícula 2026001 já existe nesta turma.')
      expect((await storedStudent(bruno.id)).registration).toBe('2026002')
    })

    it('refuses editing a student whose data was anonymized', async () => {
      const student = await add()
      await ana().post(`${studentPath(student.id)}/anonymize`)
      const response = await ana().patch(studentPath(student.id), { fullName: 'Ana de volta' })

      expect(response.status).toBe(409)
      expect((await storedStudent(student.id)).fullName).toBe('Aluno anonimizado')
    })
  })

  describe('DELETE /classes/:id/students/:studentId', () => {
    it('takes the student out of the class without deleting the record', async () => {
      const student = await add()

      expect((await ana().delete(studentPath(student.id))).status).toBe(204)
      expect(await storedStudent(student.id)).toMatchObject({ fullName: 'Ana Beatriz', removedAt: expect.any(Date) })
      expect(await listedNames()).toEqual([])
    })

    it('keeps the registration of a removed student taken, and says who holds it', async () => {
      const student = await add()
      await ana().delete(studentPath(student.id))
      const again = await ana().post(studentsOf(), ANA)

      expect(again.status).toBe(409)
      expect(again.body.message).toBe('A matrícula 2026001 é de um aluno removido desta turma.')
      expect((await importRows([ANA])).body).toEqual({ created: 0, skipped: 1 })
    })

    it('answers 404 once the student is out of the class', async () => {
      const student = await add()
      await ana().delete(studentPath(student.id))

      expect((await ana().delete(studentPath(student.id))).status).toBe(404)
      expect((await ana().patch(studentPath(student.id), { fullName: 'Ana' })).status).toBe(404)
    })
  })

  describe('POST /classes/:id/students/:studentId/anonymize', () => {
    it('erases name, registration and e-mail for good, and keeps the record', async () => {
      const student = await add()

      expect((await ana().post(`${studentPath(student.id)}/anonymize`)).status).toBe(204)

      const stored = await storedStudent(student.id)
      const anonymized = { fullName: 'Aluno anonimizado', registration: `ANON-${student.id.slice(0, 8)}` }
      expect(stored).toMatchObject({ ...anonymized, email: null, anonymizedAt: expect.any(Date) })
      expect(itemsIn(await ana().get(studentsOf()))).toEqual([
        { id: student.id, classId, ...anonymized, anonymizedAt: stored.anonymizedAt?.toISOString() },
      ])
    })

    it('changes nothing the second time', async () => {
      const student = await add()
      await ana().post(`${studentPath(student.id)}/anonymize`)
      const first = await storedStudent(student.id)

      expect((await ana().post(`${studentPath(student.id)}/anonymize`)).status).toBe(204)
      expect((await storedStudent(student.id)).anonymizedAt).toEqual(first.anonymizedAt)
    })

    it('anonymizes a student already removed from the class', async () => {
      const student = await add()
      await ana().delete(studentPath(student.id))

      expect((await ana().post(`${studentPath(student.id)}/anonymize`)).status).toBe(204)
      expect((await storedStudent(student.id)).fullName).toBe('Aluno anonimizado')
    })
  })

  /** Decided by the PM in #144: an archived class takes no new student, and keeps every right over the ones it has. */
  describe('an archived class', () => {
    const archive = () => ana().patch(`/classes/${classId}/archive`)
    const ARCHIVED = {
      code: 'conflict',
      message: 'Esta turma está arquivada. Restaure a turma para adicionar ou importar alunos.',
    }

    it('refuses a new student, saying to restore the class first', async () => {
      await archive()
      const response = await ana().post(studentsOf(), ANA)

      expect(response.status).toBe(409)
      expect(response.body).toEqual(ARCHIVED)
      expect(await listedNames()).toEqual([])
    })

    it('refuses an import and writes none of its rows', async () => {
      await archive()
      const response = await importRows([ANA, { fullName: 'Bruno', registration: '2' }])

      expect(response.status).toBe(409)
      expect(response.body).toEqual(ARCHIVED)
      expect(await listedNames()).toEqual([])
    })

    it('still edits, removes and anonymizes the students it already has', async () => {
      const student = await add()
      const bruno = await add({ fullName: 'Bruno Lima', registration: '2026002' })
      await archive()

      expect((await ana().patch(studentPath(student.id), { fullName: 'Ana B.' })).status).toBe(200)
      expect((await ana().delete(studentPath(bruno.id))).status).toBe(204)
      expect((await ana().post(`${studentPath(student.id)}/anonymize`)).status).toBe(204)
    })

    it('takes new students again once restored', async () => {
      await archive()
      await ana().patch(`/classes/${classId}/restore`)

      expect((await ana().post(studentsOf(), ANA)).status).toBe(201)
    })
  })

  describe('another teacher', () => {
    it('gets 404 on every student route, and the student stays as it was', async () => {
      const student = await add()
      const responses = await Promise.all([
        bia().get(studentsOf()),
        bia().post(studentsOf(), { ...ANA, registration: '9' }),
        bia().post(`${studentsOf()}/import`, { rows: [{ fullName: 'Bia', registration: '9' }] }),
        bia().patch(studentPath(student.id), { fullName: 'Tomada' }),
        bia().delete(studentPath(student.id)),
        bia().post(`${studentPath(student.id)}/anonymize`),
      ])

      for (const response of responses) {
        expect(response.status).toBe(404)
        expect(response.body).toEqual({ code: 'not-found', message: 'Turma não encontrada.' })
      }
      expect(await storedStudent(student.id)).toMatchObject({ fullName: 'Ana Beatriz', removedAt: null, anonymizedAt: null })
      expect(await listedNames()).toEqual(['Ana Beatriz'])
    })

    it('cannot reach a student through another class, even of the same teacher', async () => {
      const student = await add()
      const response = await ana().patch(studentPath(student.id, otherClassId), { fullName: 'Ana' })

      expect(response.status).toBe(404)
      expect(response.body.message).toBe('Aluno não encontrado.')
    })
  })
})
