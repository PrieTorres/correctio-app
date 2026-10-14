import request from 'supertest'
import type { Kysely } from 'kysely'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../app'
import { loadEnv } from '../../config/env'
import { createLogger } from '../../lib/logger'
import type { Database } from '../../models/tables'
import { signInDelayMs } from '../rate-limit'
import type { VerifyToken } from '../require-auth'

const TOKENS: Readonly<Record<string, string>> = { 'token-ana': 'ana', 'token-bia': 'bia' }
const verifyToken: VerifyToken = (token) => {
  const teacherId = TOKENS[token]
  return Promise.resolve(teacherId === undefined ? null : { teacherId })
}

function buildApp(source: NodeJS.ProcessEnv = {}) {
  return createApp({
    env: loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', ...source }),
    logger: createLogger('silent'),
    db: {} as Kysely<Database>,
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

describe('per-teacher limits', () => {
  it('limits writes per teacher without touching another teacher', async () => {
    const app = buildApp()
    await request(app).post('/classes').set('Authorization', 'Bearer token-ana')
    await request(app).post('/classes').set('Authorization', 'Bearer token-ana')
    const third = await request(app).post('/classes').set('Authorization', 'Bearer token-ana')
    const otherTeacher = await request(app).post('/classes').set('Authorization', 'Bearer token-bia')

    expect(third.status).toBe(429)
    expect(otherTeacher.status).toBe(404)
  })

  it('keeps reads in a budget of their own', async () => {
    const app = buildApp()
    await request(app).post('/classes').set('Authorization', 'Bearer token-ana')
    await request(app).post('/classes').set('Authorization', 'Bearer token-ana')
    const read = await request(app).get('/classes').set('Authorization', 'Bearer token-ana')

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
describe('signInDelayMs', () => {
  it('lets the first two attempts through at once, then waits half a second more each time, up to two seconds', () => {
    expect([1, 2, 3, 4, 5, 6, 9].map((attempt) => signInDelayMs(attempt))).toEqual([0, 0, 500, 1000, 1500, 2000, 2000])
  })
})
