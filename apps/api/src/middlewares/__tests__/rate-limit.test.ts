import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import { createApp } from '../../app'
import { loadEnv } from '../../config/env'
import { createDatabase } from '../../db/connection'
import { createLogger } from '../../lib/logger'
import type { VerifyToken } from '../require-auth'

const TOKENS: Readonly<Record<string, string>> = { 'token-ana': 'ana', 'token-bia': 'bia' }
const verifyToken: VerifyToken = (token) => {
  const teacherId = TOKENS[token]
  return Promise.resolve(teacherId === undefined ? null : { teacherId })
}

/** A real pool that never connects: no request here reaches a route that reads the database. */
const db = createDatabase({ url: 'mysql://nobody@127.0.0.1:1/none', tls: 'local' })
afterAll(() => db.destroy())

function buildApp(source: NodeJS.ProcessEnv = {}) {
  return createApp({
    env: loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', ...source }),
    logger: createLogger('silent'),
    db,
    verifyToken,
    rateLimits: {
      failedAuth: { windowMs: 60_000, limit: 2 },
      read: { windowMs: 60_000, limit: 3 },
      write: { windowMs: 60_000, limit: 2 },
    },
  })
}

describe('failed authentication limit', () => {
  it('stops an address that keeps trying tokens, in the API error shape', async () => {
    const app = buildApp()
    await request(app).get('/classes').set('Authorization', 'Bearer guess-1')
    await request(app).get('/classes').set('Authorization', 'Bearer guess-2')
    const response = await request(app).get('/classes').set('Authorization', 'Bearer token-ana')

    expect(response.status).toBe(429)
    expect(response.body.code).toBe('too-many-requests')
    expect(response.headers['retry-after']).toBe('60')
  })

  it('does not spend the address budget on signed-in requests, even ones that fail', async () => {
    const app = buildApp()
    await request(app).get('/nowhere').set('Authorization', 'Bearer token-ana')
    await request(app).get('/nowhere').set('Authorization', 'Bearer token-ana')
    await request(app).get('/classes')
    const response = await request(app).get('/classes')

    expect(response.status).toBe(401)
  })
})

describe('behind Firebase Hosting', () => {
  /** The shape measured on the first deploy: the client, then the Google proxy every request passes through. */
  const throughHosting = (client: string) => `${client}, 66.102.8.106`

  it('counts each client on its own, not the proxy they all share', async () => {
    const app = buildApp({ TRUST_PROXY_HOPS: '2' })
    await request(app).get('/classes').set('X-Forwarded-For', throughHosting('203.0.113.1'))
    await request(app).get('/classes').set('X-Forwarded-For', throughHosting('203.0.113.1'))
    const sameClient = await request(app).get('/classes').set('X-Forwarded-For', throughHosting('203.0.113.1'))
    const otherClient = await request(app).get('/classes').set('X-Forwarded-For', throughHosting('203.0.113.2'))

    expect(sameClient.status).toBe(429)
    expect(otherClient.status).toBe(401)
  })
})

/**
 * Signed in, the requests go to a path with no route: the limit is what is
 * under test, and a real route such as `/classes` would query the database.
 */
describe('per-teacher limits', () => {
  it('limits writes per teacher without touching another teacher', async () => {
    const app = buildApp()
    await request(app).post('/nowhere').set('Authorization', 'Bearer token-ana')
    await request(app).post('/nowhere').set('Authorization', 'Bearer token-ana')
    const third = await request(app).post('/nowhere').set('Authorization', 'Bearer token-ana')
    const otherTeacher = await request(app).post('/nowhere').set('Authorization', 'Bearer token-bia')

    expect(third.status).toBe(429)
    expect(otherTeacher.status).toBe(404)
  })

  it('keeps reads in a budget of their own', async () => {
    const app = buildApp()
    await request(app).post('/nowhere').set('Authorization', 'Bearer token-ana')
    await request(app).post('/nowhere').set('Authorization', 'Bearer token-ana')
    const read = await request(app).get('/nowhere').set('Authorization', 'Bearer token-ana')

    expect(read.status).toBe(404)
  })
})

describe('response headers', () => {
  it('forbids any cache from keeping an answer, including errors', async () => {
    const app = buildApp()

    expect((await request(app).get('/health')).headers['cache-control']).toBe('no-store')
    expect((await request(app).get('/classes')).headers['cache-control']).toBe('no-store')
  })

  it('tells browsers to use HTTPS only', async () => {
    const response = await request(buildApp()).get('/health')

    expect(response.headers['strict-transport-security']).toContain('max-age=')
  })
})
