import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createLogger } from '../../lib/logger'
import { createErrorHandler } from '../error-handler'
import { createRequireAuth, currentTeacherId, rejectAllTokens, type VerifyToken } from '../require-auth'

function appWith(verifyToken: VerifyToken, guarded = true) {
  const app = express()
  if (guarded) app.use(createRequireAuth(verifyToken))
  app.get('/me', (_req, res) => {
    res.json({ teacherId: currentTeacherId(res) })
  })
  app.use(createErrorHandler(createLogger('silent')))
  return app
}

describe('requireAuth', () => {
  it('hands the teacher of a valid token to the route', async () => {
    const verifyToken: VerifyToken = (token) => Promise.resolve(token === 'ok' ? { teacherId: 't7' } : null)
    const response = await request(appWith(verifyToken)).get('/me').set('Authorization', 'Bearer ok')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ teacherId: 't7' })
  })

  it('refuses everything by default, until the real check of #40 arrives', async () => {
    const response = await request(appWith(rejectAllTokens)).get('/me').set('Authorization', 'Bearer anything')

    expect(response.status).toBe(401)
  })

  it('never serves a route that reads the teacher without the gate in front of it', async () => {
    const response = await request(appWith(rejectAllTokens, false)).get('/me')

    expect(response.status).toBe(401)
    expect(response.body.code).toBe('unauthorized')
  })
})
