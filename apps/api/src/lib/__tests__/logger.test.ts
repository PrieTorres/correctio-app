import { Writable } from 'node:stream'
import express, { type Express } from 'express'
import { pino } from 'pino'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createHttpLogger } from '../logger'

const REFRESH_TOKEN = 'refresh-token-that-opens-a-session'
const ACCESS_TOKEN = 'access-token-of-the-teacher'
const CLIENT_ADDRESS = '203.0.113.7'
const SHEET_CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23'
const ONE_TIME_CODE = 'one-time-google-code'

/** An app with the request log and two routes shaped like the real ones, writing each log line to `lines`. */
function appLoggingTo(lines: string[]): Express {
  const destination = new Writable({
    write(chunk, _encoding, done) {
      lines.push(String(chunk))
      done()
    },
  })
  const app = express()
  app.set('trust proxy', 1)
  app.use(createHttpLogger(pino(destination)))
  app.post('/api/auth/refresh', (_req, res) => {
    res.cookie('__session', REFRESH_TOKEN, { httpOnly: true }).json({ accessToken: ACCESS_TOKEN })
  })
  app.get('/api/public/sheets/:code', (_req, res) => {
    res.json({})
  })
  return app
}

async function onlyLine(lines: string[]): Promise<{ text: string; entry: Record<string, Record<string, unknown>> }> {
  await vi.waitFor(() => {
    expect(lines).toHaveLength(1)
  })
  const [text = ''] = lines
  return { text, entry: JSON.parse(text) as Record<string, Record<string, unknown>> }
}

describe('createHttpLogger', () => {
  /** RNF05: a renewed session travels in `Set-Cookie` and the address in `X-Forwarded-For`; neither may reach the log. */
  it('keeps only the id, the method, the path and the status of a request', async () => {
    const lines: string[] = []

    await request(appLoggingTo(lines))
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${ACCESS_TOKEN}`)
      .set('Cookie', `__session=${REFRESH_TOKEN}`)
      .set('X-Forwarded-For', CLIENT_ADDRESS)

    const { text, entry } = await onlyLine(lines)
    expect(Object.keys(entry.req ?? {}).sort()).toEqual(['id', 'method', 'path'])
    expect(entry.req).toMatchObject({ method: 'POST', path: '/api/auth/refresh' })
    expect(entry.res).toEqual({ statusCode: 200 })
    for (const secret of [REFRESH_TOKEN, ACCESS_TOKEN, CLIENT_ADDRESS]) expect(text).not.toContain(secret)
  })

  /** The code printed on a sheet opens that student's page, and a query string can carry a one-time sign-in code. */
  it('writes the public lookup path without the sheet code or the query string', async () => {
    const lines: string[] = []

    await request(appLoggingTo(lines)).get(`/api/public/sheets/${SHEET_CODE}?google=${ONE_TIME_CODE}`)

    const { text, entry } = await onlyLine(lines)
    expect(entry.req).toMatchObject({ method: 'GET', path: '/api/public/sheets/:code' })
    expect(text).not.toContain(SHEET_CODE)
    expect(text).not.toContain(ONE_TIME_CODE)
  })
})
