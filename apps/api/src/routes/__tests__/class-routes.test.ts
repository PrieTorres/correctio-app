import { randomBytes, randomUUID } from 'node:crypto'
import type { Class } from '@correctio/domain'
import type { Express } from 'express'
import type { Kysely } from 'kysely'
import request, { type Response } from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, DATABASE_TEST_URL, type TestDatabase } from '../../__tests__/test-database'
import { createApp } from '../../app'
import { loadEnv } from '../../config/env'
import { createFieldCipher } from '../../lib/field-encryption'
import { createLogger } from '../../lib/logger'
import type { VerifyToken } from '../../middlewares/require-auth'
import type { Database } from '../../models/tables'
import { createClassRepository } from '../../repositories/class-repository'
import { createClassService } from '../../services/class-service'

const TOKENS: Readonly<Record<string, string>> = { 'token-ana': 'ana', 'token-bia': 'bia' }
const verifyToken: VerifyToken = (token) => {
  const teacherId = TOKENS[token]
  return Promise.resolve(teacherId === undefined ? null : { teacherId })
}

/** Generous budgets: these tests are about the routes, and `rate-limit.test.ts` covers the limits. */
const RELAXED = { windowMs: 60_000, limit: 10_000 }

const CALCULO = { name: 'Cálculo I', subject: 'Matemática', term: '2026/2' }

const teacher = (id: string) => ({ id, role: 'professor' as const, fullName: id, email: `${id}@exemplo.edu.br`, passwordHash: 'x' })
const namesIn = (response: Response) => (response.body as { items: Class[] }).items.map((item) => item.name)
const countsIn = (response: Response) =>
  Object.fromEntries((response.body as { items: Class[] }).items.map((item) => [item.name, item.studentCount]))

describe.runIf(DATABASE_TEST_URL !== undefined)('class routes (real MySQL)', () => {
  let database: TestDatabase
  let db: Kysely<Database>
  let app: Express

  /** `classes.teacherId` has a foreign key to `users.id`, so both teachers exist before any class. */
  beforeAll(async () => {
    database = await createTestDatabase()
    db = database.db
    await db.insertInto('users').values([teacher('ana'), teacher('bia')]).execute()

    app = createApp({
      env: loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }),
      logger: createLogger('silent'),
      db,
      verifyToken,
      fieldCipher: createFieldCipher(randomBytes(32).toString('base64')),
      rateLimits: { read: RELAXED, write: RELAXED, expensive: RELAXED },
    })
  })

  afterAll(() => database.drop())

  /** Students first, so no foreign key blocks the delete. */
  beforeEach(async () => {
    await db.deleteFrom('students').execute()
    await db.deleteFrom('classes').execute()
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

  async function create(body: object = CALCULO, token = 'token-ana'): Promise<Class> {
    const response = await asTeacher(token).post('/classes', body)
    expect(response.status).toBe(201)
    return response.body as Class
  }

  const storedClass = (id: string) => db.selectFrom('classes').selectAll().where('id', '=', id).executeTakeFirstOrThrow()

  it('requires a signed-in teacher on every class and student route', async () => {
    const id = randomUUID()
    const responses = await Promise.all([
      request(app).get('/classes'),
      request(app).post('/classes'),
      request(app).get(`/classes/${id}`),
      request(app).patch(`/classes/${id}`),
      request(app).patch(`/classes/${id}/archive`),
      request(app).patch(`/classes/${id}/restore`),
      request(app).get(`/classes/${id}/students`),
      request(app).post(`/classes/${id}/students`),
      request(app).post(`/classes/${id}/students/import`),
      request(app).patch(`/classes/${id}/students/${id}`),
      request(app).delete(`/classes/${id}/students/${id}`),
      request(app).post(`/classes/${id}/students/${id}/anonymize`),
    ])

    for (const response of responses) expect(response.status).toBe(401)
  })

  describe('POST /classes', () => {
    it('creates an active class for the teacher of the token, with an invite code', async () => {
      const response = await ana().post('/classes', CALCULO)

      expect(response.status).toBe(201)
      expect(response.body).toEqual({
        id: expect.any(String),
        teacherId: 'ana',
        ...CALCULO,
        status: 'active',
        inviteCode: expect.stringMatching(/^[A-Z2-7]{8}$/),
      })
    })

    it('takes the owner, the status and the invite code from the server, never from the body', async () => {
      const response = await ana().post('/classes', { ...CALCULO, teacherId: 'bia', status: 'archived', inviteCode: 'AAAAAAAA' })

      expect(response.body).toMatchObject({ teacherId: 'ana', status: 'active' })
      expect(response.body.inviteCode).not.toBe('AAAAAAAA')
    })

    it('gives each class its own invite code', async () => {
      const first = await create()
      const second = await create({ ...CALCULO, name: 'Física II' })

      expect(first.inviteCode).not.toBe(second.inviteCode)
    })

    it('refuses a class without a name with the message the form shows', async () => {
      const response = await ana().post('/classes', { ...CALCULO, name: '' })

      expect(response.status).toBe(400)
      expect(response.body).toEqual({ code: 'invalid', message: 'Informe o nome da turma' })
    })

    it('refuses a body that lacks a field or is not a class at all', async () => {
      const missingName = await ana().post('/classes', { subject: 'Matemática', term: '2026/2' })
      const notAClass = await ana().post('/classes', [CALCULO])

      expect(missingName.status).toBe(400)
      expect(missingName.body.code).toBe('invalid')
      expect(notAClass.status).toBe(400)
      expect(notAClass.body.code).toBe('invalid')
    })
  })

  describe('repeated classes', () => {
    it('refuses the same name in the same term, however accents, case and spaces were typed', async () => {
      await create()
      const response = await ana().post('/classes', { ...CALCULO, name: '  calculo i ' })

      expect(response.status).toBe(409)
      expect(response.body).toEqual({ code: 'conflict', message: 'Já existe uma turma com estes dados.' })
    })

    it('points at the restore when the clash is an archived class', async () => {
      const created = await create()
      await ana().patch(`/classes/${created.id}/archive`)
      const response = await ana().post('/classes', CALCULO)

      expect(response.status).toBe(409)
      expect(response.body.message).toBe('Já existe uma turma arquivada com estes dados. Restaure em vez de criar outra.')
    })

    it('allows the same name in another term, and to another teacher', async () => {
      await create()

      expect((await ana().post('/classes', { ...CALCULO, term: '2027/1' })).status).toBe(201)
      expect((await bia().post('/classes', CALCULO)).status).toBe(201)
    })

    it('refuses renaming a class onto another, and lets a class keep its own name', async () => {
      await create()
      const other = await create({ ...CALCULO, name: 'Álgebra Linear' })

      expect((await ana().patch(`/classes/${other.id}`, { name: 'CALCULO I' })).status).toBe(409)
      expect((await ana().patch(`/classes/${other.id}`, { subject: 'Álgebra' })).status).toBe(200)
    })
  })

  describe('GET /classes', () => {
    it('lists only the classes of the teacher, by name, with the total', async () => {
      await create({ ...CALCULO, name: 'Física II', subject: 'Física' })
      await create()
      await create({ ...CALCULO, name: 'Química' }, 'token-bia')
      const response = await ana().get('/classes')

      expect(response.status).toBe(200)
      expect(response.body.total).toBe(2)
      expect(namesIn(response)).toEqual(['Cálculo I', 'Física II'])
    })

    it('finds by name or subject, without accents or case', async () => {
      await create()
      await create({ name: 'Física II', subject: 'Física', term: '2026/2' })

      expect(namesIn(await ana().get('/classes').query({ search: 'calculo' }))).toEqual(['Cálculo I'])
      expect(namesIn(await ana().get('/classes').query({ search: 'FISICA' }))).toEqual(['Física II'])
      expect(namesIn(await ana().get('/classes').query({ search: 'matemática' }))).toEqual(['Cálculo I'])
    })

    it('takes % and _ in the search literally', async () => {
      await create({ name: '100% online', subject: 'EAD', term: '2026/2' })
      await create({ name: 'Turma A', subject: 'Laboratorio_1', term: '2026/2' })
      await create({ name: 'Turma B', subject: 'Laboratorio 2', term: '2026/2' })

      expect(namesIn(await ana().get('/classes').query({ search: '%' }))).toEqual(['100% online'])
      expect(namesIn(await ana().get('/classes').query({ search: '_' }))).toEqual(['Turma A'])
    })

    it('lists archived classes only when asked', async () => {
      const archived = await create()
      await create({ ...CALCULO, name: 'Física II' })
      await ana().patch(`/classes/${archived.id}/archive`)

      expect(namesIn(await ana().get('/classes'))).toEqual(['Física II'])
      expect(namesIn(await ana().get('/classes').query({ archived: 'true' }))).toEqual(['Cálculo I'])
    })

    it('pages after filtering, with the total of every page', async () => {
      for (const className of ['C', 'A', 'B']) await create({ ...CALCULO, name: className })
      const response = await ana().get('/classes').query({ page: 2, pageSize: 2 })

      expect(response.body.total).toBe(3)
      expect(namesIn(response)).toEqual(['C'])
    })

    /** #146: the cards of P3 show the same number as "Alunos (N)" on P5, from one grouped query per page. */
    it('counts the students of each class, anonymized ones in and removed ones out', async () => {
      const calculo = await create()
      await create({ ...CALCULO, name: 'Física II' })
      const added = await Promise.all(
        ['Ana Lima', 'Bruno Melo', 'Carla Dias'].map((fullName, index) =>
          ana().post(`/classes/${calculo.id}/students`, { fullName, registration: `20260${index}` }),
        ),
      )
      expect(added.map((response) => response.status)).toEqual([201, 201, 201])
      const [anonymized, removed] = added.map((response) => (response.body as { id: string }).id)

      expect((await ana().post(`/classes/${calculo.id}/students/${anonymized}/anonymize`)).status).toBe(204)
      expect((await ana().delete(`/classes/${calculo.id}/students/${removed}`)).status).toBe(204)

      expect(countsIn(await ana().get('/classes'))).toEqual({ 'Cálculo I': 2, 'Física II': 0 })
    })

    it('counts the archived classes too, and only the students of the teacher', async () => {
      const archived = await create()
      await ana().post(`/classes/${archived.id}/students`, { fullName: 'Ana Lima', registration: '202601' })
      await ana().patch(`/classes/${archived.id}/archive`)
      const ofBia = await create(CALCULO, 'token-bia')
      await bia().post(`/classes/${ofBia.id}/students`, { fullName: 'Davi Reis', registration: '202602' })

      expect(countsIn(await ana().get('/classes').query({ archived: 'true' }))).toEqual({ 'Cálculo I': 1 })
      expect(countsIn(await bia().get('/classes'))).toEqual({ 'Cálculo I': 1 })
    })

    it('refuses a page size above 1000 instead of cutting the list', async () => {
      const response = await ana().get('/classes').query({ pageSize: 1001 })

      expect(response.status).toBe(400)
      expect(response.body.code).toBe('invalid')
    })
  })

  describe('GET /classes/:id', () => {
    it('answers a class of the teacher with the fields of the contract only', async () => {
      const created = await create()

      expect((await ana().get(`/classes/${created.id}`)).body).toEqual(created)
    })

    it('answers 404, never 403, for a class of another teacher or one that does not exist', async () => {
      const created = await create()
      const fromBia = await bia().get(`/classes/${created.id}`)

      expect(fromBia.status).toBe(404)
      expect(fromBia.body).toEqual({ code: 'not-found', message: 'Turma não encontrada.' })
      expect((await ana().get(`/classes/${randomUUID()}`)).status).toBe(404)
    })
  })

  describe('PATCH /classes/:id', () => {
    it('changes only what was sent, keeping the invite code and the status', async () => {
      const created = await create()
      const response = await ana().patch(`/classes/${created.id}`, { subject: 'Cálculo aplicado' })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ ...created, subject: 'Cálculo aplicado' })
      expect(await storedClass(created.id)).toMatchObject({
        name: 'Cálculo I',
        term: '2026/2',
        status: 'active',
        inviteCode: created.inviteCode,
      })
    })

    it('ignores what is outside the form, so a body cannot move the class or change its status', async () => {
      const created = await create()
      const response = await ana().patch(`/classes/${created.id}`, {
        name: 'Cálculo II',
        teacherId: 'bia',
        status: 'archived',
        inviteCode: 'AAAAAAAA',
      })

      expect(response.body).toEqual({ ...created, name: 'Cálculo II' })
      expect(await storedClass(created.id)).toMatchObject({ teacherId: 'ana', status: 'active', inviteCode: created.inviteCode })
    })

    it('writes nothing when the body carries nothing of the form', async () => {
      const created = await create()
      const before = await storedClass(created.id)
      const response = await ana().patch(`/classes/${created.id}`, { status: 'archived' })

      expect(response.body).toEqual(created)
      expect(await storedClass(created.id)).toEqual(before)
    })

    it('refuses emptying or clearing a required field, and a body that is not an object', async () => {
      const created = await create()
      const emptied = await ana().patch(`/classes/${created.id}`, { name: '' })
      const cleared = await ana().patch(`/classes/${created.id}`, { name: null })
      const notAnObject = await ana().patch(`/classes/${created.id}`, ['Cálculo II'])

      expect(emptied.body).toEqual({ code: 'invalid', message: 'Informe o nome da turma' })
      expect(cleared.status).toBe(400)
      expect(notAnObject.body).toEqual({ code: 'invalid', message: 'Dados inválidos.' })
      expect((await storedClass(created.id)).name).toBe('Cálculo I')
    })

    it('answers 404 for a class of another teacher, and leaves it alone', async () => {
      const created = await create()

      expect((await bia().patch(`/classes/${created.id}`, { name: 'Tomada' })).status).toBe(404)
      expect((await storedClass(created.id)).name).toBe('Cálculo I')
    })
  })

  describe('archive and restore', () => {
    it('archives without deleting, and restores', async () => {
      const created = await create()

      expect((await ana().patch(`/classes/${created.id}/archive`)).status).toBe(204)
      expect((await storedClass(created.id)).status).toBe('archived')
      expect((await ana().get(`/classes/${created.id}`)).body.status).toBe('archived')

      expect((await ana().patch(`/classes/${created.id}/restore`)).status).toBe(204)
      expect((await storedClass(created.id)).status).toBe('active')
    })

    it('answers 404 to another teacher, without archiving anything', async () => {
      const created = await create()

      expect((await bia().patch(`/classes/${created.id}/archive`)).status).toBe(404)
      expect((await bia().patch(`/classes/${created.id}/restore`)).status).toBe(404)
      expect((await storedClass(created.id)).status).toBe('active')
    })
  })

  /**
   * No request can make two classes draw the same code, so these call the
   * service with codes the test chooses. The clash still comes from the real
   * unique index of the table.
   */
  describe('invite code clash', () => {
    const withName = (className: string) => ({ ...CALCULO, name: className })

    it('draws another code when the first one is already taken', async () => {
      const codes = ['AAAAAAAA', 'AAAAAAAA', 'BBBBBBBB']
      const service = createClassService({ repository: createClassRepository(db), newInviteCode: () => codes.shift() ?? '' })

      const first = await service.create('ana', withName('Cálculo I'))
      const second = await service.create('ana', withName('Cálculo II'))

      expect(first.inviteCode).toBe('AAAAAAAA')
      expect(second.inviteCode).toBe('BBBBBBBB')
    })

    it('gives up after three clashes instead of looping, and writes nothing', async () => {
      const service = createClassService({ repository: createClassRepository(db), newInviteCode: () => 'CCCCCCCC' })
      await service.create('ana', withName('Física I'))

      await expect(service.create('ana', withName('Física II'))).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' })
      expect(await db.selectFrom('classes').select('id').where('name', '=', 'Física II').execute()).toEqual([])
    })
  })
})
