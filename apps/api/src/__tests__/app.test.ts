import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../app'
import { loadEnv } from '../config/env'
import { createLogger } from '../lib/logger'
import type { VerifyToken } from '../middlewares/require-auth'

const ALLOWED_ORIGIN = 'http://localhost:5173'
const env = loadEnv({ NODE_ENV: 'test', CORS_ORIGINS: ALLOWED_ORIGIN, LOG_LEVEL: 'silent' })
const logger = createLogger('silent')
const verifyToken: VerifyToken = (token) => Promise.resolve(token === 'valid-token' ? { teacherId: 't1' } : null)

function buildApp(healthChecks: (() => Promise<boolean>)[] = []) {
  return createApp({ env, logger, verifyToken, healthChecks })
}

describe('GET /health', () => {
  it('answers without a token', async () => {
    const response = await request(buildApp()).get('/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'UP' })
  })

  it('answers 503 when a dependency is down', async () => {
    const response = await request(buildApp([() => Promise.resolve(false)])).get('/health')

    expect(response.status).toBe(503)
    expect(response.body).toEqual({ status: 'DOWN' })
  })
})

describe('closed by default', () => {
  it('refuses any other route without a token, even one that does not exist', async () => {
    const response = await request(buildApp()).get('/classes')

    expect(response.status).toBe(401)
    expect(response.body).toEqual({ code: 'unauthorized', message: 'Faça login para continuar.' })
  })

  it('refuses a token the verifier does not accept', async () => {
    const response = await request(buildApp()).get('/classes').set('Authorization', 'Bearer forged')

    expect(response.status).toBe(401)
  })

  it('refuses a header that is not a bearer token', async () => {
    const response = await request(buildApp()).get('/classes').set('Authorization', 'valid-token')

    expect(response.status).toBe(401)
  })

  it('answers an unknown route in the error shape once signed in', async () => {
    const response = await request(buildApp()).get('/nowhere').set('Authorization', 'Bearer valid-token')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ code: 'not-found', message: 'Rota não encontrada.' })
  })
})

describe('request limits and headers', () => {
  it('refuses a JSON body over 100 KB', async () => {
    const response = await request(buildApp())
      .post('/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ text: 'x'.repeat(110 * 1024) }))

    expect(response.status).toBe(400)
    expect(response.body.code).toBe('invalid')
  })

  it('refuses a body that is not valid JSON', async () => {
    const response = await request(buildApp()).post('/health').set('Content-Type', 'application/json').send('{"broken"')

    expect(response.status).toBe(400)
    expect(response.body).toEqual({ code: 'invalid', message: 'O corpo da requisição não é um JSON válido.' })
  })

  it('sends the security headers', async () => {
    const response = await request(buildApp()).get('/health')

    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['x-powered-by']).toBeUndefined()
  })
})

describe('CORS', () => {
  it('allows the configured origin', async () => {
    const response = await request(buildApp()).get('/health').set('Origin', ALLOWED_ORIGIN)

    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN)
  })

  it('does not allow any other origin', async () => {
    const response = await request(buildApp()).get('/health').set('Origin', 'https://evil.example')

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })
})
