import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { sql, type Kysely } from 'kysely'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Express } from 'express'
import { createApp } from '../../app'
import { loadEnv } from '../../config/env'
import { createLogger } from '../../lib/logger'
import type { Database } from '../../models/tables'
import { createDatabase } from '../../db/connection'
import { MIGRATION_COMMAND, migrate } from '../../db/migrator'
import type { VerifyToken } from '../../middlewares/require-auth'

/**
 * Runs against a real MySQL: `docker compose up -d mysql` locally, the MySQL
 * service in CI. A skipped test in CI would let a renamed column slip through,
 * so the same rule the schema test follows applies here.
 */
const serverUrl = process.env.DATABASE_TEST_URL
if (serverUrl === undefined && process.env.CI !== undefined) {
  throw new Error('DATABASE_TEST_URL is required in CI')
}

const TOKENS: Readonly<Record<string, string>> = { 'token-ana': 'ana', 'token-bia': 'bia' }
const verifyToken = ((token: string) => {
  const id = TOKENS[token]
  return Promise.resolve(id === undefined ? null : { teacherId: id })
}) as VerifyToken

const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent' })
const logger = createLogger('silent')

/** A fresh multiple-choice question, with ids the schema accepts. */
function makeQuestion(statement = 'What is 2 + 2?') {
  const alternativeA = randomUUID()
  const alternativeB = randomUUID()
  return {
    type: 'objetiva' as const,
    statement,
    alternatives: [
      { id: alternativeA, text: '3' },
      { id: alternativeB, text: '4' },
    ],
    correctAlternativeId: alternativeB,
    tags: ['math'],
    maxScore: 1,
    allowShuffleAlternatives: true,
  }
}

describe.runIf(serverUrl !== undefined)('question routes (real MySQL)', () => {
  const name = `correctio_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`
  let server: Kysely<Database>
  let db: Kysely<Database>
  let app: Express

  /**
   * `questions.teacherId` has a foreign key to `users.id`, so the two teachers
   * must exist before any question can be written.
   */
  beforeAll(async () => {
    server = createDatabase({ url: serverUrl ?? '', tls: 'local' })
    await sql`CREATE DATABASE ${sql.id(name)}`.execute(server)
    const url = new URL(serverUrl ?? '')
    url.pathname = `/${name}`
    db = createDatabase({ url: url.toString(), tls: 'local' })
    await migrate(db, MIGRATION_COMMAND.LATEST)

    await db
      .insertInto('users')
      .values([
        { id: 'ana', role: 'professor', fullName: 'Ana', email: 'ana@exemplo.edu.br', passwordHash: 'x' },
        { id: 'bia', role: 'professor', fullName: 'Bia', email: 'bia@exemplo.edu.br', passwordHash: 'x' },
      ])
      .execute()

    app = createApp({ env, logger, db, verifyToken })
  })

  afterAll(async () => {
    await db.destroy()
    await sql`DROP DATABASE IF EXISTS ${sql.id(name)}`.execute(server)
    await server.destroy()
  })

  /** Child tables first, so no foreign key blocks the delete. */
  beforeEach(async () => {
    await db.deleteFrom('question_alternatives').execute()
    await db.deleteFrom('question_tags').execute()
    await db.deleteFrom('questions').execute()
  })

  const post = (token: string, body: object) =>
    request(app).post('/questions').set('Authorization', `Bearer ${token}`).send(body)

  describe('POST /questions', () => {
    it('creates a question for the signed-in teacher', async () => {
      const res = await post('token-ana', makeQuestion())
      expect(res.status).toBe(201)
      expect(res.body.id).toBeDefined()
      expect(res.body.teacherId).toBe('ana')
      expect(res.body.statement).toBe('What is 2 + 2?')
      expect(res.body.tags).toEqual(['math'])
      expect(res.body.alternatives).toHaveLength(2)
    })

    it('persists into the child tables', async () => {
      const created = await post('token-ana', makeQuestion())
      const alternatives = await db
        .selectFrom('question_alternatives')
        .selectAll()
        .where('questionId', '=', created.body.id)
        .execute()
      const tags = await db
        .selectFrom('question_tags')
        .selectAll()
        .where('questionId', '=', created.body.id)
        .execute()

      expect(alternatives).toHaveLength(2)
      expect(tags.map((t) => t.tag)).toEqual(['math'])
    })

    it('requires authentication', async () => {
      const res = await request(app).post('/questions').send(makeQuestion())
      expect(res.status).toBe(401)
    })
  })

  describe('GET /questions with filters', () => {
    it('lists only the teacher own questions', async () => {
      await post('token-ana', makeQuestion('Ana question'))
      await post('token-bia', makeQuestion('Bia question'))

      const list = await request(app).get('/questions').set('Authorization', 'Bearer token-ana')
      expect(list.status).toBe(200)
      expect(list.body.total).toBe(1)
      expect(list.body.items[0].teacherId).toBe('ana')
    })

    it('filters by type', async () => {
      await post('token-ana', makeQuestion())

      const filtered = await request(app)
        .get('/questions?type=discursiva')
        .set('Authorization', 'Bearer token-ana')
      expect(filtered.status).toBe(200)
      expect(filtered.body.total).toBe(0)
    })

    it('searches the statement and the tags', async () => {
      await post('token-ana', makeQuestion('What is 2 + 2?'))

      const found = await request(app)
        .get('/questions?search=2')
        .set('Authorization', 'Bearer token-ana')
      expect(found.body.total).toBe(1)

      const notFound = await request(app)
        .get('/questions?search=Banana')
        .set('Authorization', 'Bearer token-ana')
      expect(notFound.body.total).toBe(0)
    })
  })

  describe('PATCH /questions/:id', () => {
    it('edits a question the teacher owns', async () => {
      const created = await post('token-ana', makeQuestion())

      const updated = await request(app)
        .patch(`/questions/${created.body.id}`)
        .set('Authorization', 'Bearer token-ana')
        .send({ statement: 'Updated' })

      expect(updated.status).toBe(200)
      expect(updated.body.statement).toBe('Updated')
    })

    it('returns 404 when the other teacher tries to edit', async () => {
      const created = await post('token-ana', makeQuestion())

      const forbidden = await request(app)
        .patch(`/questions/${created.body.id}`)
        .set('Authorization', 'Bearer token-bia')
        .send({ statement: 'hacked' })

      expect(forbidden.status).toBe(404)
    })

    it('clears the alternatives when a question becomes discursive', async () => {
      const created = await post('token-ana', makeQuestion())

      const updated = await request(app)
        .patch(`/questions/${created.body.id}`)
        .set('Authorization', 'Bearer token-ana')
        .send({
          type: 'discursiva',
          alternatives: null,
          correctAlternativeId: null,
          maxScore: 2.5,
        })

      expect(updated.status).toBe(200)
      expect(updated.body.type).toBe('discursiva')
      expect(updated.body.alternatives).toBeUndefined()
      expect(updated.body.correctAlternativeId).toBeUndefined()
      expect(updated.body.maxScore).toBe(2.5)

      const left = await db
        .selectFrom('question_alternatives')
        .selectAll()
        .where('questionId', '=', created.body.id)
        .execute()
      expect(left).toHaveLength(0)
    })
  })

  describe('DELETE /questions/:id (archive)', () => {
    it('archives a question', async () => {
      const created = await post('token-ana', makeQuestion())

      const archived = await request(app)
        .delete(`/questions/${created.body.id}`)
        .set('Authorization', 'Bearer token-ana')
      expect(archived.status).toBe(204)

      const active = await request(app).get('/questions').set('Authorization', 'Bearer token-ana')
      expect(active.body.total).toBe(0)

      const archivedList = await request(app)
        .get('/questions?archived=true')
        .set('Authorization', 'Bearer token-ana')
      expect(archivedList.body.total).toBe(1)
    })

    it('returns 404 when the other teacher tries to archive', async () => {
      const created = await post('token-ana', makeQuestion())

      const forbidden = await request(app)
        .delete(`/questions/${created.body.id}`)
        .set('Authorization', 'Bearer token-bia')
      expect(forbidden.status).toBe(404)
    })
  })

  describe('PATCH /questions/:id/restore', () => {
    it('restores an archived question', async () => {
      const created = await post('token-ana', makeQuestion())
      await request(app)
        .delete(`/questions/${created.body.id}`)
        .set('Authorization', 'Bearer token-ana')

      const restored = await request(app)
        .patch(`/questions/${created.body.id}/restore`)
        .set('Authorization', 'Bearer token-ana')
      expect(restored.status).toBe(204)

      const active = await request(app).get('/questions').set('Authorization', 'Bearer token-ana')
      expect(active.body.total).toBe(1)
    })

    it('returns 404 when the other teacher tries to restore', async () => {
      const created = await post('token-ana', makeQuestion())
      await request(app)
        .delete(`/questions/${created.body.id}`)
        .set('Authorization', 'Bearer token-ana')

      const forbidden = await request(app)
        .patch(`/questions/${created.body.id}/restore`)
        .set('Authorization', 'Bearer token-bia')
      expect(forbidden.status).toBe(404)
    })
  })

  describe('GET /questions/:id', () => {
    it('returns a question the teacher owns', async () => {
      const created = await post('token-ana', makeQuestion())

      const fetched = await request(app)
        .get(`/questions/${created.body.id}`)
        .set('Authorization', 'Bearer token-ana')
      expect(fetched.status).toBe(200)
      expect(fetched.body.statement).toBe('What is 2 + 2?')
    })

    it('returns 404 when the other teacher tries to read', async () => {
      const created = await post('token-ana', makeQuestion())

      const forbidden = await request(app)
        .get(`/questions/${created.body.id}`)
        .set('Authorization', 'Bearer token-bia')
      expect(forbidden.status).toBe(404)
    })
  })

  describe('GET /questions/tags', () => {
    it('returns distinct tags from the teacher own active questions', async () => {
      await post('token-ana', { ...makeQuestion('A'), tags: ['math', 'algebra'] })
      await post('token-ana', { ...makeQuestion('B'), tags: ['math', 'geometry'] })

      const res = await request(app)
        .get('/questions/tags')
        .set('Authorization', 'Bearer token-ana')

      expect(res.status).toBe(200)
      expect(res.body.tags).toEqual(['algebra', 'geometry', 'math'])
    })

    it('does not leak tags from another teacher', async () => {
      await post('token-bia', { ...makeQuestion(), tags: ['bia-only'] })

      const res = await request(app)
        .get('/questions/tags')
        .set('Authorization', 'Bearer token-ana')

      expect(res.status).toBe(200)
      expect(res.body.tags).toEqual([])
    })

    it('requires authentication', async () => {
      const res = await request(app).get('/questions/tags')
      expect(res.status).toBe(401)
    })
  })

  describe('GET /questions extra filters', () => {
    it('filters by tags (all must be present)', async () => {
      await post('token-ana', { ...makeQuestion('A'), tags: ['math', 'algebra'] })
      await post('token-ana', { ...makeQuestion('B'), tags: ['math'] })

      const res = await request(app)
        .get('/questions?tags=math&tags=algebra')
        .set('Authorization', 'Bearer token-ana')

      expect(res.status).toBe(200)
      expect(res.body.total).toBe(1)
      expect(res.body.items[0].statement).toBe('A')
    })

    it('filters by onlyUntagged', async () => {
      await post('token-ana', { ...makeQuestion('tagged'), tags: ['math'] })
      await post('token-ana', { ...makeQuestion('untagged'), tags: [] })

      const res = await request(app)
        .get('/questions?onlyUntagged=true')
        .set('Authorization', 'Bearer token-ana')

      expect(res.status).toBe(200)
      expect(res.body.total).toBe(1)
      expect(res.body.items[0].statement).toBe('untagged')
    })

    it('sorts by statement when asked', async () => {
      await post('token-ana', makeQuestion('Zebra'))
      await post('token-ana', makeQuestion('Apple'))

      const res = await request(app)
        .get('/questions?sort=statement')
        .set('Authorization', 'Bearer token-ana')

      expect(res.status).toBe(200)
      expect(res.body.items[0].statement).toBe('Apple')
      expect(res.body.items[1].statement).toBe('Zebra')
    })

    it('paginates', async () => {
      await post('token-ana', makeQuestion('Q1'))
      await post('token-ana', makeQuestion('Q2'))
      await post('token-ana', makeQuestion('Q3'))

      const page1 = await request(app)
        .get('/questions?page=1&pageSize=2')
        .set('Authorization', 'Bearer token-ana')
      expect(page1.body.items).toHaveLength(2)
      expect(page1.body.total).toBe(3)

      const page2 = await request(app)
        .get('/questions?page=2&pageSize=2')
        .set('Authorization', 'Bearer token-ana')
      expect(page2.body.items).toHaveLength(1)
    })
  })

  describe('not-found paths', () => {
    it('PATCH /questions/:id returns 404 for an unknown id', async () => {
      const res = await request(app)
        .patch('/questions/does-not-exist')
        .set('Authorization', 'Bearer token-ana')
        .send({ statement: 'x' })
      expect(res.status).toBe(404)
    })

    it('DELETE /questions/:id returns 404 for an unknown id', async () => {
      const res = await request(app)
        .delete('/questions/does-not-exist')
        .set('Authorization', 'Bearer token-ana')
      expect(res.status).toBe(404)
    })

    it('PATCH /questions/:id/restore returns 404 for an unknown id', async () => {
      const res = await request(app)
        .patch('/questions/does-not-exist/restore')
        .set('Authorization', 'Bearer token-ana')
      expect(res.status).toBe(404)
    })
  })
})