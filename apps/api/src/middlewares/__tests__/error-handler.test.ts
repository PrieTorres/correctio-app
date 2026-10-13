import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { API_ERROR_CODE, ApiError } from '../../lib/api-error'
import { createLogger } from '../../lib/logger'
import { createErrorHandler } from '../error-handler'

function appThrowing(error: unknown) {
  const logger = createLogger('silent')
  const logged = vi.spyOn(logger, 'error')
  const app = express()
  app.get('/boom', () => {
    throw error
  })
  app.use(createErrorHandler(logger))
  return { app, logged }
}

describe('error handler', () => {
  it('answers an ApiError with its status, code and message', async () => {
    const { app, logged } = appThrowing(new ApiError(API_ERROR_CODE.CONFLICT, 'Já existe uma turma com estes dados.'))
    const response = await request(app).get('/boom')

    expect(response.status).toBe(409)
    expect(response.body).toEqual({ code: 'conflict', message: 'Já existe uma turma com estes dados.' })
    expect(logged).not.toHaveBeenCalled()
  })

  it('tells a throttled client when to come back', async () => {
    const { app } = appThrowing(
      new ApiError(API_ERROR_CODE.TOO_MANY_REQUESTS, 'Muitas tentativas.', { retryAfterSeconds: 60 }),
    )
    const response = await request(app).get('/boom')

    expect(response.status).toBe(429)
    expect(response.headers['retry-after']).toBe('60')
    expect(response.body.code).toBe('too-many-requests')
  })

  it('hides an unexpected error behind a generic failure and logs it', async () => {
    const { app, logged } = appThrowing(new Error('connection refused at 10.0.0.5'))
    const response = await request(app).get('/boom')

    expect(response.status).toBe(500)
    expect(response.body).toEqual({ code: 'failure', message: 'Erro inesperado. Tente de novo em instantes.' })
    expect(JSON.stringify(response.body)).not.toContain('10.0.0.5')
    expect(logged).toHaveBeenCalledOnce()
  })
})
