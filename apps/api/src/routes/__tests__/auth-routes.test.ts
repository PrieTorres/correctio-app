import { createHash, randomUUID } from 'node:crypto'
import type { Express } from 'express'
import type { Kysely } from 'kysely'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, DATABASE_TEST_URL, type TestDatabase } from '../../__tests__/test-database'
import { createApp } from '../../app'
import { composeAuth } from '../../compose-auth'
import { loadEnv } from '../../config/env'
import { createLogger } from '../../lib/logger'
import type { Database } from '../../models/tables'
import type { GoogleIdentity, GoogleProfile } from '../../services/google-identity'
import type { MailMessage } from '../../services/mailer'

const APP_URL = 'https://correctio-app.web.app'
const PREVIEW_URL = 'https://correctio-app--feat-login-ab12cd34.web.app'
const PASSWORD = 'senha-forte-1'
const BINDING = 'segredo-que-so-o-navegador-tem'
const SIGN_IN_FAILED = 'E-mail ou senha incorretos.'

const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_SECRET: Buffer.alloc(32, 5).toString('base64'), PUBLIC_APP_URL: APP_URL })
const logger = createLogger('silent')

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function uniqueEmail(): string {
  return `prof-${randomUUID().slice(0, 8)}@exemplo.edu.br`
}

/** `__session=<token>`, ready to go back in a `Cookie` header. */
function sessionCookieOf(response: request.Response): string {
  const cookie = response.get('Set-Cookie')?.find((header) => header.startsWith('__session='))
  if (cookie === undefined) throw new Error('no session cookie in the response')
  return cookie.split(';')[0] ?? ''
}

describe.runIf(DATABASE_TEST_URL !== undefined)('authentication routes (real MySQL)', () => {
  let database: TestDatabase
  let db: Kysely<Database>
  let app: Express
  const mails: MailMessage[] = []
  const googleProfiles = new Map<string, GoogleProfile>()

  /** Plays Google's part: the consent screen hands back whatever profile the test registered for the code. */
  const google: GoogleIdentity = {
    authorizationUrl: (state) => `https://accounts.google.test/auth?state=${encodeURIComponent(state)}`,
    identify: (code) => Promise.resolve(googleProfiles.get(code) ?? null),
  }

  function buildApp(identity: GoogleIdentity | null = google, signInDelayStepMs = 0): Express {
    const auth = composeAuth({ env, db, logger, google: identity, passwordResetResponseMs: 0, mailer: { send: (mail) => Promise.resolve(void mails.push(mail)) } })
    return createApp({ env, logger, db, auth, signInDelayStepMs })
  }

  beforeAll(async () => {
    database = await createTestDatabase()
    db = database.db
    app = buildApp()
  })

  afterAll(async () => {
    await database.drop()
  })

  beforeEach(() => {
    mails.length = 0
    googleProfiles.clear()
  })

  const register = (email: string, password = PASSWORD) =>
    request(app).post('/auth/register').send({ fullName: 'Ana Lima', email, password })
  const signIn = (email: string, password = PASSWORD, target = app) => request(target).post('/auth/login').send({ email, password })
  const refresh = (cookie: string) => request(app).post('/auth/refresh').set('Cookie', cookie)

  describe('sign-up', () => {
    it('creates a teacher, answers with an access token and keeps the refresh token in an httpOnly cookie', async () => {
      const email = uniqueEmail()
      const response = await register(email)

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({ expiresIn: 900, user: { email, fullName: 'Ana Lima', role: 'professor' } })
      expect(response.body.accessToken).toEqual(expect.any(String))
      expect(response.body.user).not.toHaveProperty('passwordHash')
      expect(response.body).not.toHaveProperty('refreshToken')
      expect(response.get('Set-Cookie')?.[0]).toMatch(/^__session=.+; Max-Age=2592000; Path=\/api\/auth; Expires=.+; HttpOnly; Secure; SameSite=Strict$/)
    })

    it('stores only an argon2id hash of the password and only a hash of the refresh token', async () => {
      const email = uniqueEmail()
      const response = await register(email)
      const token = sessionCookieOf(response).replace('__session=', '')

      const user = await db.selectFrom('users').select(['id', 'passwordHash']).where('email', '=', email).executeTakeFirstOrThrow()
      const stored = await db.selectFrom('refresh_tokens').select('tokenHash').where('userId', '=', user.id).executeTakeFirstOrThrow()
      expect(user.passwordHash).toMatch(/^\$argon2id\$/)
      expect(stored.tokenHash).toBe(sha256(token))
    })

    it('refuses an e-mail that already has an account, whatever its case', async () => {
      const email = uniqueEmail()
      await register(email)
      const response = await register(email.toUpperCase())

      expect(response.status).toBe(409)
      expect(response.body.code).toBe('conflict')
    })

    it('refuses a password shorter than 8 characters, with the message the form shows', async () => {
      const response = await register(uniqueEmail(), 'curta12')

      expect(response.status).toBe(400)
      expect(response.body.message).toBe('A senha precisa ter ao menos 8 caracteres')
    })
  })

  describe('sign-in', () => {
    it('signs in with the right password', async () => {
      const email = uniqueEmail()
      await register(email)
      const response = await signIn(email)

      expect(response.status).toBe(200)
      expect(response.body.user.email).toBe(email)
      expect(sessionCookieOf(response)).toMatch(/^__session=/)
    })

    it('says the same for a wrong password and for an address without an account', async () => {
      const email = uniqueEmail()
      await register(email)
      const wrongPassword = await signIn(email, 'outra-senha-1')
      const noAccount = await signIn(uniqueEmail())

      expect(wrongPassword.status).toBe(401)
      expect(noAccount.status).toBe(401)
      expect(wrongPassword.body.message).toBe(SIGN_IN_FAILED)
      expect(noAccount.body.message).toBe(SIGN_IN_FAILED)
    })

    it('blocks an address and e-mail after 5 failures in 15 minutes, saying when to try again', async () => {
      const email = uniqueEmail()
      await register(email)
      for (let attempt = 0; attempt < 5; attempt += 1) await signIn(email, 'chute-errado')
      const blocked = await signIn(email)

      expect(blocked.status).toBe(429)
      expect(blocked.body.code).toBe('too-many-requests')
      expect(blocked.get('Retry-After')).toBe('900')
    })

    it('does not count a correct sign-in towards the block', async () => {
      const email = uniqueEmail()
      await register(email)
      for (let attempt = 0; attempt < 4; attempt += 1) await signIn(email, 'chute-errado')
      await signIn(email)
      const fifthFailure = await signIn(email, 'chute-errado')

      expect(fifthFailure.status).toBe(401)
    })

    it('makes each failure after the second wait longer', async () => {
      const slowed = buildApp(google, 100)
      const email = uniqueEmail()
      await signIn(email, 'chute-errado', slowed)
      await signIn(email, 'chute-errado', slowed)
      const started = performance.now()
      await signIn(email, 'chute-errado', slowed)

      expect(performance.now() - started).toBeGreaterThanOrEqual(90)
    })

    it('does not let an anonymized account in', async () => {
      const email = uniqueEmail()
      await register(email)
      await db.updateTable('users').set({ anonymizedAt: new Date() }).where('email', '=', email).execute()

      expect((await signIn(email)).status).toBe(401)
    })
  })

  describe('session', () => {
    it('answers /me for the access token, without the password hash', async () => {
      const email = uniqueEmail()
      const { body } = await register(email)
      const response = await request(app).get('/me').set('Authorization', `Bearer ${body.accessToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({ id: body.user.id, email })
      expect(response.body).not.toHaveProperty('passwordHash')
    })

    it('refuses /me without a valid access token', async () => {
      expect((await request(app).get('/me')).status).toBe(401)
      expect((await request(app).get('/me').set('Authorization', 'Bearer forjado')).status).toBe(401)
    })

    it('rotates the refresh token: the new one works and the old one is revoked', async () => {
      const first = sessionCookieOf(await register(uniqueEmail()))
      const renewed = await refresh(first)
      const second = sessionCookieOf(renewed)

      expect(renewed.status).toBe(200)
      expect(renewed.body.accessToken).toEqual(expect.any(String))
      expect(second).not.toBe(first)
      expect((await refresh(first)).status).toBe(401)
    })

    it('refuses a token sent twice in a row without ending the session that won', async () => {
      const first = sessionCookieOf(await register(uniqueEmail()))
      const second = sessionCookieOf(await refresh(first))

      expect((await refresh(first)).status).toBe(401)
      expect((await refresh(second)).status).toBe(200)
    })

    it('ends every session of the account when an old refresh token comes back', async () => {
      const first = sessionCookieOf(await register(uniqueEmail()))
      const second = sessionCookieOf(await refresh(first))
      await db
        .updateTable('refresh_tokens')
        .set({ revokedAt: new Date(Date.now() - 60_000) })
        .where('tokenHash', '=', sha256(first.replace('__session=', '')))
        .execute()

      expect((await refresh(first)).status).toBe(401)
      expect((await refresh(second)).status).toBe(401)
    })

    it('refuses a refresh without a cookie and drops a refused cookie', async () => {
      const refused = await refresh('__session=desconhecido')

      expect((await request(app).post('/auth/refresh')).status).toBe(401)
      expect(refused.status).toBe(401)
      expect(refused.get('Set-Cookie')?.[0]).toMatch(/^__session=; Path=\/api\/auth; Expires=Thu, 01 Jan 1970/)
    })

    it('logout revokes the token of this device only', async () => {
      const email = uniqueEmail()
      const thisDevice = sessionCookieOf(await register(email))
      const otherDevice = sessionCookieOf(await signIn(email))
      const response = await request(app).post('/auth/logout').set('Cookie', thisDevice)

      expect(response.status).toBe(204)
      expect((await refresh(thisDevice)).status).toBe(401)
      expect((await refresh(otherDevice)).status).toBe(200)
    })

    it('logout-all revokes every device, and needs the access token', async () => {
      const email = uniqueEmail()
      const { body } = await register(email)
      const devices = [sessionCookieOf(await signIn(email)), sessionCookieOf(await signIn(email))]

      expect((await request(app).post('/auth/logout-all')).status).toBe(401)
      expect((await request(app).post('/auth/logout-all').set('Authorization', `Bearer ${body.accessToken}`)).status).toBe(204)
      for (const device of devices) expect((await refresh(device)).status).toBe(401)
    })
  })

  describe('password reset', () => {
    const forgot = (email: string) => request(app).post('/auth/forgot-password').send({ email })
    const reset = (code: string, password = 'senha-nova-1') => request(app).post('/auth/reset-password').send({ code, password })
    const codeOf = (mail: MailMessage | undefined) => /codigo=([\w-]+)/.exec(mail?.text ?? '')?.[1] ?? ''

    it('answers the same with or without an account, and e-mails only the account', async () => {
      const email = uniqueEmail()
      await register(email)
      const withAccount = await forgot(email)
      const withoutAccount = await forgot(uniqueEmail())

      expect(withAccount.status).toBe(204)
      expect(withoutAccount.status).toBe(204)
      expect(mails).toHaveLength(1)
      expect(mails[0]?.to).toBe(email)
      expect(mails[0]?.text).toContain(`${APP_URL}/redefinir-senha?codigo=`)
    })

    it('sets the new password, ends every session and works only once', async () => {
      const email = uniqueEmail()
      const session = sessionCookieOf(await register(email))
      await forgot(email)
      const code = codeOf(mails[0])

      expect((await reset(code)).status).toBe(204)
      expect((await signIn(email, 'senha-nova-1')).status).toBe(200)
      expect((await signIn(email)).status).toBe(401)
      expect((await refresh(session)).status).toBe(401)
      expect((await reset(code, 'outra-nova-1')).status).toBe(400)
    })

    it('refuses an expired link', async () => {
      const email = uniqueEmail()
      await register(email)
      await forgot(email)
      await db.updateTable('auth_codes').set({ expiresAt: new Date(Date.now() - 1000) }).where('usedAt', 'is', null).execute()

      expect((await reset(codeOf(mails[0]))).status).toBe(400)
    })
  })

  describe('Google', () => {
    const start = (returnTo: string, binding = BINDING, target = app) =>
      request(target).get('/auth/google').query({ returnTo, binding: sha256(binding) })

    /** Start, consent and callback, as the browser goes through them; answers where the browser lands. */
    async function throughGoogle(profile: GoogleProfile, returnTo = APP_URL): Promise<URL> {
      const consent = new URL((await start(returnTo)).get('Location') ?? '')
      googleProfiles.set('codigo-do-google', profile)
      const callback = await request(app).get('/auth/google/callback').query({ code: 'codigo-do-google', state: consent.searchParams.get('state') })
      return new URL(callback.get('Location') ?? '')
    }

    const exchange = (code: string | null, binding = BINDING) => request(app).post('/auth/google/exchange').send({ code, binding })

    it('creates the account on the first sign-in and hands out the same session as a password', async () => {
      const email = uniqueEmail()
      const landing = await throughGoogle({ email, fullName: 'Bia Souza' })
      const response = await exchange(landing.searchParams.get('google'))

      expect(`${landing.origin}${landing.pathname}`).toBe(`${APP_URL}/entrar`)
      expect(response.status).toBe(200)
      expect(response.body.user).toMatchObject({ email, fullName: 'Bia Souza' })
      expect(sessionCookieOf(response)).toMatch(/^__session=/)
    })

    it('never makes a second account for the same e-mail', async () => {
      const email = uniqueEmail()
      const first = await exchange((await throughGoogle({ email, fullName: 'Bia' })).searchParams.get('google'))
      const second = await exchange((await throughGoogle({ email: email.toUpperCase(), fullName: 'Bia' })).searchParams.get('google'))

      expect(second.body.user.id).toBe(first.body.user.id)
    })

    it('returns to the preview link of a branch, through the fixed address Google knows', async () => {
      const landing = await throughGoogle({ email: uniqueEmail(), fullName: 'Bia' }, PREVIEW_URL)

      expect(landing.origin).toBe(PREVIEW_URL)
      expect((await exchange(landing.searchParams.get('google'))).status).toBe(200)
    })

    it('refuses to return anywhere else', async () => {
      expect((await start('https://atacante.example')).status).toBe(400)
      expect((await start('https://outro-projeto--canal.web.app')).status).toBe(400)
    })

    it('does not exchange the code in a browser that did not start the sign-in, nor twice', async () => {
      const code = (await throughGoogle({ email: uniqueEmail(), fullName: 'Bia' })).searchParams.get('google')

      expect((await exchange(code, 'segredo-de-outro-navegador')).status).toBe(401)
      expect((await exchange(code)).status).toBe(200)
      expect((await exchange(code)).status).toBe(401)
    })

    it('takes over an account whose inbox nobody proved: its password stops working and its sessions end', async () => {
      const email = uniqueEmail()
      const squatter = sessionCookieOf(await register(email))
      const response = await exchange((await throughGoogle({ email, fullName: 'Dona do e-mail' })).searchParams.get('google'))

      expect(response.status).toBe(200)
      expect((await signIn(email)).status).toBe(401)
      expect((await refresh(squatter)).status).toBe(401)
    })

    it('keeps the password of an account whose inbox was already proven', async () => {
      const email = uniqueEmail()
      await register(email)
      await db.updateTable('users').set({ emailVerifiedAt: new Date() }).where('email', '=', email).execute()
      await exchange((await throughGoogle({ email, fullName: 'Ana' })).searchParams.get('google'))

      expect((await signIn(email)).status).toBe(200)
    })

    it('lands on the sign-in page with an error when the person cancels on Google or the state was forged', async () => {
      const consent = new URL((await start(APP_URL)).get('Location') ?? '')
      const canceled = await request(app).get('/auth/google/callback').query({ error: 'access_denied', state: consent.searchParams.get('state') })
      const unknownCode = await request(app).get('/auth/google/callback').query({ code: 'recusado', state: consent.searchParams.get('state') })
      const forged = await request(app).get('/auth/google/callback').query({ code: 'x', state: 'forjado' })

      expect(canceled.get('Location')).toBe(`${APP_URL}/entrar?erro=google`)
      expect(unknownCode.get('Location')).toBe(`${APP_URL}/entrar?erro=google`)
      expect(forged.get('Location')).toBe(`${APP_URL}/entrar?erro=google`)
    })

    it('ends on the sign-in page with an error where Google is not configured', async () => {
      const response = await start(PREVIEW_URL, BINDING, buildApp(null))

      expect(response.status).toBe(302)
      expect(response.get('Location')).toBe(`${PREVIEW_URL}/entrar?erro=google`)
    })
  })
})
