import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { bootstrapApi } from '../bootstrap'
import { loadEnv } from '../config/env'

const UNREACHABLE_DATABASE = 'mysql://nobody@127.0.0.1:1/none'

describe('bootstrapApi', () => {
  it('refuses to start without a database', () => {
    expect(() => bootstrapApi(loadEnv({ NODE_ENV: 'test' }))).toThrow(/DATABASE_URL/)
  })

  it('serves sign-in and keeps the account routes behind the token check', async () => {
    const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', DATABASE_URL: UNREACHABLE_DATABASE, DATABASE_TLS: 'local' })
    const { app, db } = bootstrapApi(env, { basePath: '/api' })
    try {
      const signIn = await request(app).post('/api/auth/login').send({ email: 'nao-e-email' })
      const me = await request(app).get('/api/me')

      expect(signIn.status).toBe(400)
      expect(me.status).toBe(401)
    } finally {
      await db.destroy()
    }
  })

  it('checks the database in /health, under the path it was given', async () => {
    const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', DATABASE_URL: UNREACHABLE_DATABASE, DATABASE_TLS: 'local' })
    const { app, db } = bootstrapApi(env, { basePath: '/api' })
    try {
      const response = await request(app).get('/api/health')

      expect(response.status).toBe(503)
      expect(response.body).toEqual({ status: 'DOWN' })
    } finally {
      await db.destroy()
    }
  })
})
