import { randomBytes } from 'node:crypto'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { bootstrapApi } from '../bootstrap'
import { loadEnv } from '../config/env'

const UNREACHABLE_DATABASE = 'mysql://nobody@127.0.0.1:1/none'
const ENCRYPTION_KEY = randomBytes(32).toString('base64')

describe('bootstrapApi', () => {
  it('refuses to start without a database', () => {
    expect(() => bootstrapApi(loadEnv({ NODE_ENV: 'test', DATA_ENCRYPTION_KEY: ENCRYPTION_KEY }))).toThrow(/DATABASE_URL/)
  })

  /** The migrations run without the key, so `loadEnv` accepts its absence; the API that stores e-mails does not. */
  it('refuses to start without the key that encrypts the student e-mail', () => {
    const env = loadEnv({ NODE_ENV: 'test', DATABASE_URL: UNREACHABLE_DATABASE, DATABASE_TLS: 'local' })

    expect(() => bootstrapApi(env)).toThrow(/DATA_ENCRYPTION_KEY/)
  })

  it('checks the database in /health, under the path it was given', async () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: UNREACHABLE_DATABASE,
      DATABASE_TLS: 'local',
      DATA_ENCRYPTION_KEY: ENCRYPTION_KEY,
    })
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
