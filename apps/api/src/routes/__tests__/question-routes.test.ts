/* eslint-disable */
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@correctio/domain', () => ({
  questionInputSchema: {
    safeParse: (data: unknown) => ({ success: true, data }),
  },
}))

import { createApp } from '../../app'
import { loadEnv } from '../../config/env'
import { createLogger } from '../../lib/logger'
import type { VerifyToken } from '../../middlewares/require-auth'

interface Row {
  id: string
  teacherId: string
  type: string
  statement: string
  tags: string
  alternatives: string | null
  correctAlternativeId: string | null
  maxScore: number | null
  allowShuffleAlternatives: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

function makeFakeDb() {
  const store: Row[] = []

  function selectBuilder() {
    const state: any = {
      filters: [] as Array<(r: Row) => boolean>,
      orderBy: null as { col: string; dir: 'asc' | 'desc' } | null,
      limit: null as number | null,
      offset: 0,
      selectExpr: 'all' as 'all' | 'count',
    }
    const run = () => store.filter((r) => state.filters.every((f: any) => f(r)))

    const b: any = {
      where: (a: any, op?: any, val?: any) => {
        if (typeof a === 'function') {
          const eb: any = (col: string, o: string, v: any) => ({ __eb: true, col, o, v })
          eb.or = (exprs: any[]) => ({ __or: true, exprs })
          eb.and = (exprs: any[]) => ({ __and: true, exprs })
          eb.bxp = (lhs: string, _o: string, rhs: any) => ({ __bxp: true, lhs, rhs })
          eb.fn = { count: () => ({ as: () => ({}) }) }

          const expr = a(eb)

          if (expr && expr.__or) {
            state.filters.push((r: Row) => {
              return expr.exprs.some((e: any) => {
                if (!e.__eb) return false
                const rowVal = String((r as any)[e.col] ?? '')
                if (e.o === 'like') {
                  const rx = new RegExp(String(e.v).replace(/%/g, '.*'))
                  return rx.test(rowVal)
                }
                return false
              })
            })
          } else if (expr && expr.__bxp && expr.lhs === 'JSON_CONTAINS(tags)') {
            const tag = String(expr.rhs).replace(/^"|"$/g, '')
            state.filters.push((r: Row) => {
              try {
                const tags = JSON.parse(r.tags)
                return Array.isArray(tags) && tags.includes(tag)
              } catch {
                return false
              }
            })
          }
        } else {
          const col = a as keyof Row
          state.filters.push((r: Row) => {
            if (op === '=') return r[col] === val
            if (op === 'is') return r[col] === null || r[col] === undefined
            if (op === 'is not') return r[col] !== null && r[col] !== undefined
            if (op === 'like') {
              const rx = new RegExp(String(val).replace(/%/g, '.*'))
              return rx.test(String(r[col] ?? ''))
            }
            return false
          })
        }
        return b
      },
      selectAll: () => { state.selectExpr = 'all'; return b },
      select: () => { state.selectExpr = 'count'; return b },
      orderBy: (col: string, dir: 'asc' | 'desc') => { state.orderBy = { col, dir }; return b },
      limit: (n: number) => { state.limit = n; return b },
      offset: (n: number) => { state.offset = n; return b },
      executeTakeFirst: async () => {
        const m = run()
        return m[0] ? { ...m[0] } : undefined
      },
      executeTakeFirstOrThrow: async () => {
        if (state.selectExpr === 'count') return { count: run().length }
        const m = run()
        if (!m[0]) throw new Error('no result')
        return { ...m[0] }
      },
      execute: async () => {
        let result = run()
        if (state.orderBy) {
          const { col, dir } = state.orderBy
          result = [...result].sort((x: any, y: any) => {
            const av = x[col]
            const bv = y[col]
            if (av < bv) return dir === 'asc' ? -1 : 1
            if (av > bv) return dir === 'asc' ? 1 : -1
            return 0
          })
        }
        if (state.limit !== null) result = result.slice(state.offset, state.offset + state.limit)
        return result.map((r) => ({ ...r }))
      },
    }
    return b
  }

  return {
    insertInto: () => ({
      values: (data: Row) => ({
        execute: async () => {
          store.push({ ...data })
        },
      }),
    }),
    selectFrom: () => selectBuilder(),
    updateTable: () => {
      const filters: Array<(r: Row) => boolean> = []
      let setData: any = {}
      const b: any = {
        set: (d: any) => { setData = d; return b },
        where: (col: string, op: string, val: any) => {
          filters.push((r: Row) => (op === '=' ? r[col as keyof Row] === val : false))
          return b
        },
        execute: async () => {
          for (const r of store) if (filters.every((f) => f(r))) Object.assign(r, setData)
        },
      }
      return b
    },
  } as any
}

const TOKENS: Readonly<Record<string, string>> = { 'token-ana': 'ana', 'token-bia': 'bia' }
const verifyToken = ((token: string) => {
  const id = TOKENS[token]
  return Promise.resolve(id === undefined ? null : ({ teacherId: id } as any))
}) as VerifyToken

const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent' })
const logger = createLogger('silent')

function buildApp() {
  return createApp({ env, logger, db: makeFakeDb(), verifyToken })
}

const QUESTION = {
  type: 'objective',
  statement: 'What is 2 + 2?',
  alternatives: [
    { id: 'a', text: '3' },
    { id: 'b', text: '4' },
  ],
  correctAlternativeId: 'b',
  tags: ['math'],
  maxScore: 1,
}

describe('POST /questions', () => {
  it('creates a question for the signed-in teacher', async () => {
    const res = await request(buildApp())
      .post('/questions')
      .set('Authorization', 'Bearer token-ana')
      .send(QUESTION)
    expect(res.status).toBe(201)
    expect(res.body.id).toBeDefined()
    expect(res.body.teacherId).toBe('ana')
    expect(res.body.statement).toBe('What is 2 + 2?')
  })

  it('requires authentication', async () => {
    const res = await request(buildApp()).post('/questions').send(QUESTION)
    expect(res.status).toBe(401)
  })
})

describe('GET /questions with filters', () => {
  it('lists only the teacher own questions', async () => {
    const app = buildApp()
    await request(app).post('/questions').set('Authorization', 'Bearer token-ana').send(QUESTION)
    await request(app)
      .post('/questions')
      .set('Authorization', 'Bearer token-bia')
      .send({ ...QUESTION, statement: 'Bia question' })

    const list = await request(app).get('/questions').set('Authorization', 'Bearer token-ana')
    expect(list.status).toBe(200)
    expect(list.body.total).toBe(1)
    expect(list.body.items[0].teacherId).toBe('ana')
  })

  it('filters by type', async () => {
    const app = buildApp()
    await request(app).post('/questions').set('Authorization', 'Bearer token-ana').send(QUESTION)

    const filtered = await request(app)
      .get('/questions?type=discursive')
      .set('Authorization', 'Bearer token-ana')
    expect(filtered.status).toBe(200)
    expect(filtered.body.total).toBe(0)
  })

  it('filters by search on statement', async () => {
    const app = buildApp()
    await request(app).post('/questions').set('Authorization', 'Bearer token-ana').send(QUESTION)

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
    const app = buildApp()
    const created = await request(app)
      .post('/questions')
      .set('Authorization', 'Bearer token-ana')
      .send(QUESTION)

    const updated = await request(app)
      .patch(`/questions/${created.body.id}`)
      .set('Authorization', 'Bearer token-ana')
      .send({ statement: 'Updated' })

    expect(updated.status).toBe(200)
    expect(updated.body.statement).toBe('Updated')
  })

  it('returns 404 when the other teacher tries to edit', async () => {
    const app = buildApp()
    const created = await request(app)
      .post('/questions')
      .set('Authorization', 'Bearer token-ana')
      .send(QUESTION)

    const forbidden = await request(app)
      .patch(`/questions/${created.body.id}`)
      .set('Authorization', 'Bearer token-bia')
      .send({ statement: 'hacked' })

    expect(forbidden.status).toBe(404)
  })
})

describe('DELETE /questions/:id (archive)', () => {
  it('archives a question', async () => {
    const app = buildApp()
    const created = await request(app)
      .post('/questions')
      .set('Authorization', 'Bearer token-ana')
      .send(QUESTION)

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
    const app = buildApp()
    const created = await request(app)
      .post('/questions')
      .set('Authorization', 'Bearer token-ana')
      .send(QUESTION)

    const forbidden = await request(app)
      .delete(`/questions/${created.body.id}`)
      .set('Authorization', 'Bearer token-bia')
    expect(forbidden.status).toBe(404)
  })
})

describe('PATCH /questions/:id/restore', () => {
  it('restores an archived question', async () => {
    const app = buildApp()
    const created = await request(app)
      .post('/questions')
      .set('Authorization', 'Bearer token-ana')
      .send(QUESTION)
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
    const app = buildApp()
    const created = await request(app)
      .post('/questions')
      .set('Authorization', 'Bearer token-ana')
      .send(QUESTION)
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
  it('returns 404 when the other teacher tries to read', async () => {
    const app = buildApp()
    const created = await request(app)
      .post('/questions')
      .set('Authorization', 'Bearer token-ana')
      .send(QUESTION)

    const forbidden = await request(app)
      .get(`/questions/${created.body.id}`)
      .set('Authorization', 'Bearer token-bia')
    expect(forbidden.status).toBe(404)
  })
})

describe('GET /questions/tags', () => {
  it('returns distinct tags from the teacher own active questions', async () => {
    const app = buildApp()
    await request(app)
      .post('/questions')
      .set('Authorization', 'Bearer token-ana')
      .send({ ...QUESTION, tags: ['math', 'algebra'] })
    await request(app)
      .post('/questions')
      .set('Authorization', 'Bearer token-ana')
      .send({ ...QUESTION, statement: 'outra', tags: ['math', 'geometry'] })

    const res = await request(app)
      .get('/questions/tags')
      .set('Authorization', 'Bearer token-ana')

    expect(res.status).toBe(200)
    expect(res.body.tags).toEqual(['algebra', 'geometry', 'math'])
  })

  it('does not leak tags from another teacher', async () => {
    const app = buildApp()
    await request(app)
      .post('/questions')
      .set('Authorization', 'Bearer token-bia')
      .send({ ...QUESTION, tags: ['bia-only'] })

    const res = await request(app)
      .get('/questions/tags')
      .set('Authorization', 'Bearer token-ana')

    expect(res.status).toBe(200)
    expect(res.body.tags).toEqual([])
  })

  it('requires authentication', async () => {
    const res = await request(buildApp()).get('/questions/tags')
    expect(res.status).toBe(401)
  })
})

describe('GET /questions extra filters', () => {
  it('filters by tags (all must be present)', async () => {
    const app = buildApp()
    await request(app)
      .post('/questions')
      .set('Authorization', 'Bearer token-ana')
      .send({ ...QUESTION, statement: 'A', tags: ['math', 'algebra'] })
    await request(app)
      .post('/questions')
      .set('Authorization', 'Bearer token-ana')
      .send({ ...QUESTION, statement: 'B', tags: ['math'] })

    const res = await request(app)
      .get('/questions?tags=math&tags=algebra')
      .set('Authorization', 'Bearer token-ana')
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(1)
    expect(res.body.items[0].statement).toBe('A')
  })

  it('filters by onlyUntagged', async () => {
    const app = buildApp()
    await request(app)
      .post('/questions')
      .set('Authorization', 'Bearer token-ana')
      .send({ ...QUESTION, statement: 'tagged', tags: ['math'] })
    await request(app)
      .post('/questions')
      .set('Authorization', 'Bearer token-ana')
      .send({ ...QUESTION, statement: 'untagged', tags: [] })

    const res = await request(app)
      .get('/questions?onlyUntagged=true')
      .set('Authorization', 'Bearer token-ana')
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(1)
    expect(res.body.items[0].statement).toBe('untagged')
  })

  it('sorts by statement when asked', async () => {
    const app = buildApp()
    await request(app)
      .post('/questions')
      .set('Authorization', 'Bearer token-ana')
      .send({ ...QUESTION, statement: 'Zebra' })
    await request(app)
      .post('/questions')
      .set('Authorization', 'Bearer token-ana')
      .send({ ...QUESTION, statement: 'Apple' })

    const res = await request(app)
      .get('/questions?sort=statement')
      .set('Authorization', 'Bearer token-ana')
    expect(res.status).toBe(200)
    expect(res.body.items[0].statement).toBe('Apple')
    expect(res.body.items[1].statement).toBe('Zebra')
  })

  it('paginates', async () => {
    const app = buildApp()
    for (let i = 1; i <= 3; i++) {
      await request(app)
        .post('/questions')
        .set('Authorization', 'Bearer token-ana')
        .send({ ...QUESTION, statement: `Q${i}` })
    }

    const page1 = await request(app)
      .get('/questions?page=1&pageSize=2')
      .set('Authorization', 'Bearer token-ana')
    expect(page1.body.items.length).toBe(2)
    expect(page1.body.total).toBe(3)

    const page2 = await request(app)
      .get('/questions?page=2&pageSize=2')
      .set('Authorization', 'Bearer token-ana')
    expect(page2.body.items.length).toBe(1)
  })
})

describe('not-found paths on update, archive, restore', () => {
  it('PATCH /questions/:id returns 404 for an unknown id', async () => {
    const app = buildApp()
    const res = await request(app)
      .patch('/questions/does-not-exist')
      .set('Authorization', 'Bearer token-ana')
      .send({ statement: 'x' })
    expect(res.status).toBe(404)
  })

  it('DELETE /questions/:id returns 404 for an unknown id', async () => {
    const app = buildApp()
    const res = await request(app)
      .delete('/questions/does-not-exist')
      .set('Authorization', 'Bearer token-ana')
    expect(res.status).toBe(404)
  })

  it('PATCH /questions/:id/restore returns 404 for an unknown id', async () => {
    const app = buildApp()
    const res = await request(app)
      .patch('/questions/does-not-exist/restore')
      .set('Authorization', 'Bearer token-ana')
    expect(res.status).toBe(404)
  })
})