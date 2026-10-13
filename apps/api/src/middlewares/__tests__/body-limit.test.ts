import express, { type RequestHandler } from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createLogger } from '../../lib/logger'
import { BODY_LIMIT_BYTES, limitBodySize } from '../body-limit'
import { createErrorHandler } from '../error-handler'

/** What the Firebase Functions runtime leaves on the request after reading the body itself. */
function bodyAlreadyRead(bytes: number): RequestHandler {
  return (req, _res, next) => {
    Object.assign(req, { rawBody: Buffer.alloc(bytes) })
    next()
  }
}

function appWith(...before: RequestHandler[]) {
  const app = express()
  app.use(...before, limitBodySize)
  app.post('/echo', (_req, res) => {
    res.json({ ok: true })
  })
  app.use(createErrorHandler(createLogger('silent')))
  return app
}

describe('limitBodySize', () => {
  it('lets a body within the limit through', async () => {
    const response = await request(appWith(bodyAlreadyRead(BODY_LIMIT_BYTES))).post('/echo')

    expect(response.status).toBe(200)
  })

  it('refuses a body the hosting runtime already read when it is over the limit', async () => {
    const response = await request(appWith(bodyAlreadyRead(BODY_LIMIT_BYTES + 1))).post('/echo')

    expect(response.status).toBe(400)
    expect(response.body).toEqual({ code: 'invalid', message: 'A requisição passou do limite de 100 KB.' })
  })

  it('refuses a declared length over the limit before reading anything', async () => {
    const response = await request(appWith())
      .post('/echo')
      .set('Content-Type', 'text/plain')
      .send('x'.repeat(BODY_LIMIT_BYTES + 1))

    expect(response.status).toBe(400)
  })
})
