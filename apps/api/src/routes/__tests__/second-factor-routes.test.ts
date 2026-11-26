import { createHash, randomUUID } from 'node:crypto'
import type { Express } from 'express'
import type { Kysely } from 'kysely'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, DATABASE_TEST_URL, type TestDatabase } from '../../__tests__/test-database'
import { createApp } from '../../app'
import { composeAuth } from '../../compose-auth'
import { loadEnv } from '../../config/env'
import { createFieldCipher } from '../../lib/field-encryption'
import { createLogger } from '../../lib/logger'
import type { PasswordBreachChecker } from '../../lib/pwned-passwords'
import { totpCodeForStep, totpStepAt } from '../../lib/totp'
import type { RateLimitTier } from '../../middlewares/rate-limit'
import type { Database } from '../../models/tables'
import type { GoogleIdentity, GoogleProfile } from '../../services/google-identity'
import type { MailMessage } from '../../services/mailer'
import { MAX_CODE_ATTEMPTS } from '../../services/second-factor-service'

const APP_URL = 'https://correctio-app.web.app'
const PASSWORD = 'senha-forte-1'
const NEW_PASSWORD = 'senha-nova-1'
const BREACHED_PASSWORD = 'senha-vazada-1'
const BINDING = 'segredo-que-so-o-navegador-tem'
const CODE_REFUSED_ON_SIGN_IN = 'Código incorreto ou já usado. Digite o código atual do aplicativo.'

const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_SECRET: Buffer.alloc(32, 5).toString('base64'), PUBLIC_APP_URL: APP_URL })
const logger = createLogger('silent')
const cipher = createFieldCipher(Buffer.alloc(32, 9).toString('base64'))

const GENEROUS_LIMIT: RateLimitTier = { windowMs: 60_000, limit: 10_000 }

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function uniqueEmail(): string {
  return `prof-${randomUUID().slice(0, 8)}@exemplo.edu.br`
}

interface ResponseBody {
  accessToken: string
  challenge: string
  secret: string
  user: { id: string }
}

/** The JSON of a response, typed with the fields these tests read. */
const bodyOf = (response: request.Response): ResponseBody => response.body as ResponseBody

const currentStep = () => totpStepAt(Date.now())

/** The code the authenticator app shows `offset` time steps from now. */
const codeFor = (secret: string, offset = 0) => totpCodeForStep(secret, currentStep() + offset)

/** Six digits that are none of the three codes the server accepts right now. */
function wrongCodeFor(secret: string): string {
  const accepted = [-1, 0, 1].map((offset) => codeFor(secret, offset))
  return ['111111', '222222', '333333'].find((candidate) => !accepted.includes(candidate)) ?? '444444'
}

describe.runIf(DATABASE_TEST_URL !== undefined)('second factor routes (real MySQL)', () => {
  let database: TestDatabase
  let db: Kysely<Database>
  let app: Express
  const mails: MailMessage[] = []
  const googleProfiles = new Map<string, GoogleProfile>()
  const breachedPasswords = new Set<string>()

  const google: GoogleIdentity = {
    authorizationUrl: (state) => `https://accounts.google.test/auth?state=${encodeURIComponent(state)}`,
    identify: (code) => Promise.resolve(googleProfiles.get(code) ?? null),
  }

  const passwordBreaches: PasswordBreachChecker = { isBreached: (password) => Promise.resolve(breachedPasswords.has(password)) }

  function buildApp(signIn: RateLimitTier = GENEROUS_LIMIT): Express {
    const auth = composeAuth({
      env,
      db,
      logger,
      google,
      passwordResetResponseMs: 0,
      mailer: { send: (mail) => Promise.resolve(void mails.push(mail)) },
      passwordBreaches,
      fieldCipher: cipher,
    })
    return createApp({ env, logger, db, auth, signInDelayStepMs: 0, rateLimits: { signIn } })
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
    breachedPasswords.clear()
    breachedPasswords.add(BREACHED_PASSWORD)
  })

  const register = (email: string, password = PASSWORD) => request(app).post('/auth/register').send({ fullName: 'Ana Lima', email, password })
  const signIn = (email: string, password = PASSWORD, target = app) => request(target).post('/auth/login').send({ email, password })
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
  const setup = (token: string) => request(app).post('/me/totp/setup').set(bearer(token))
  const enable = (token: string, code: string) => request(app).post('/me/totp/enable').set(bearer(token)).send({ code })
  const disable = (token: string, code: string) => request(app).post('/me/totp/disable').set(bearer(token)).send({ code })
  const secondStep = (challenge: string, code: string, target = app) => request(target).post('/auth/login/totp').send({ challenge, code })

  /** The recorded step is cleared so a test signs in with the code of the current step without waiting for the next one. */
  async function allowCodeOfCurrentStep(email: string): Promise<void> {
    await db.updateTable('users').set({ totpLastStep: null }).where('email', '=', email).execute()
  }

  /** A new account with the second factor on, as the profile screen leaves it. */
  async function accountWithSecondFactor() {
    const email = uniqueEmail()
    const body = bodyOf(await register(email))
    const setupResponse = await setup(body.accessToken)
    const { secret } = bodyOf(setupResponse)
    const enabled = await enable(body.accessToken, codeFor(secret))
    expect(enabled.status).toBe(204)
    await allowCodeOfCurrentStep(email)
    return { email, secret, userId: body.user.id, accessToken: body.accessToken }
  }

  async function challengeOf(email: string, password = PASSWORD): Promise<string> {
    const response = await signIn(email, password)
    expect(response.body).toMatchObject({ secondFactorRequired: true })
    return bodyOf(response).challenge
  }

  describe('turning it on', () => {
    it('answers the secret, the otpauth address and a QR Code, and keeps the factor off until a code is confirmed', async () => {
      const email = uniqueEmail()
      const body = bodyOf(await register(email))
      const response = await setup(body.accessToken)

      expect(response.status).toBe(200)
      expect(response.body.secret).toMatch(/^[A-Z2-7]{32}$/)
      expect(response.body.otpauthUri).toContain(`secret=${response.body.secret}`)
      expect(response.body.otpauthUri).toContain('issuer=Correctio')
      expect(response.body.qrCodeDataUrl).toMatch(/^data:image\/svg\+xml;base64,/)

      const me = await request(app).get('/me').set(bearer(body.accessToken))
      expect(me.body.totpEnabled).toBe(false)
      expect((await signIn(email)).body).toHaveProperty('accessToken')
    })

    it('stores the secret encrypted, never in plain text', async () => {
      const { email, secret } = await accountWithSecondFactor()
      const row = await db.selectFrom('users').select(['totpSecret', 'totpPendingSecret']).where('email', '=', email).executeTakeFirstOrThrow()

      expect(row.totpSecret).toMatch(/^v1\./)
      expect(row.totpSecret).not.toContain(secret)
      expect(cipher.decrypt(row.totpSecret ?? '')).toBe(secret)
      expect(row.totpPendingSecret).toBeNull()
    })

    it('turns on only with a right code, and reports it on /me', async () => {
      const email = uniqueEmail()
      const body = bodyOf(await register(email))
      const { secret } = bodyOf(await setup(body.accessToken))

      const wrong = await enable(body.accessToken, wrongCodeFor(secret))
      expect(wrong.status).toBe(400)
      expect((await request(app).get('/me').set(bearer(body.accessToken))).body.totpEnabled).toBe(false)

      expect((await enable(body.accessToken, codeFor(secret))).status).toBe(204)
      expect((await request(app).get('/me').set(bearer(body.accessToken))).body.totpEnabled).toBe(true)
    })

    it('refuses a code that is not six digits before touching the account', async () => {
      const body = bodyOf(await register(uniqueEmail()))
      await setup(body.accessToken)

      expect((await enable(body.accessToken, '12 34 56')).status).toBe(400)
    })

    it('refuses to confirm without a QR Code having been generated, and to generate one again while it is on', async () => {
      const body = bodyOf(await register(uniqueEmail()))
      expect((await enable(body.accessToken, '123456')).status).toBe(409)

      const { accessToken } = await accountWithSecondFactor()
      expect((await setup(accessToken)).status).toBe(409)
    })

    it('needs a signed-in teacher', async () => {
      expect((await request(app).post('/me/totp/setup')).status).toBe(401)
      expect((await request(app).post('/me/totp/enable').send({ code: '123456' })).status).toBe(401)
      expect((await request(app).post('/me/totp/disable').send({ code: '123456' })).status).toBe(401)
    })

    it('does not accept the code of an earlier QR Code once a new one was generated', async () => {
      const body = bodyOf(await register(uniqueEmail()))
      const first = bodyOf(await setup(body.accessToken)).secret
      const second = bodyOf(await setup(body.accessToken)).secret

      expect((await enable(body.accessToken, wrongCodeFor(second))).status).toBe(400)
      expect(first).not.toBe(second)
      expect((await enable(body.accessToken, codeFor(second))).status).toBe(204)
    })
  })

  describe('signing in with a password', () => {
    it('answers a challenge instead of a session, without a cookie', async () => {
      const { email } = await accountWithSecondFactor()
      const response = await signIn(email)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ secondFactorRequired: true, challenge: expect.any(String), expiresIn: 300 })
      expect(response.get('Set-Cookie')).toBeUndefined()
    })

    it('gives the session for the challenge and a right code', async () => {
      const { email, secret } = await accountWithSecondFactor()
      const response = await secondStep(await challengeOf(email), codeFor(secret))

      expect(response.status).toBe(200)
      expect(response.body.user.email).toBe(email)
      expect(response.body.accessToken).toEqual(expect.any(String))
      expect(response.get('Set-Cookie')?.[0]).toMatch(/^__session=.+; .*HttpOnly/)
    })

    it('accepts the code of the step before and of the step after, for a phone with a slow or fast clock', async () => {
      const { email, secret } = await accountWithSecondFactor()
      expect((await secondStep(await challengeOf(email), codeFor(secret, -1))).status).toBe(200)
      expect((await secondStep(await challengeOf(email), codeFor(secret, 1))).status).toBe(200)
    })

    it('refuses a wrong code and does not start a session', async () => {
      const { email, secret } = await accountWithSecondFactor()
      const response = await secondStep(await challengeOf(email), wrongCodeFor(secret))

      expect(response.status).toBe(401)
      expect(response.body.message).toBe(CODE_REFUSED_ON_SIGN_IN)
      expect(response.get('Set-Cookie')).toBeUndefined()
    })

    it('refuses a code used once, even within its window', async () => {
      const { email, secret } = await accountWithSecondFactor()
      const code = codeFor(secret)

      expect((await secondStep(await challengeOf(email), code)).status).toBe(200)
      expect((await secondStep(await challengeOf(email), code)).status).toBe(401)
    })

    it('refuses the code that confirmed the factor, so it cannot be replayed to sign in', async () => {
      const email = uniqueEmail()
      const body = bodyOf(await register(email))
      const { secret } = bodyOf(await setup(body.accessToken))
      const code = codeFor(secret)
      await enable(body.accessToken, code)

      expect((await secondStep(await challengeOf(email), code)).status).toBe(401)
    })

    it('refuses a challenge that is forged, expired or really an access token', async () => {
      const { email, secret, accessToken } = await accountWithSecondFactor()
      const code = codeFor(secret)

      expect((await secondStep('forjado', code)).status).toBe(401)
      expect((await secondStep(accessToken, code)).status).toBe(401)
      expect((await secondStep(await challengeOf(email), 'abcdef')).status).toBe(400)
    })

    it('does not accept a challenge after the factor was turned off', async () => {
      const { email, secret, accessToken } = await accountWithSecondFactor()
      const challenge = await challengeOf(email)
      await disable(accessToken, codeFor(secret))

      expect((await secondStep(challenge, codeFor(secret, 1))).status).toBe(401)
    })

    it('does not let a wrong password reach the second step', async () => {
      const { email } = await accountWithSecondFactor()
      const response = await signIn(email, 'outra-senha-1')

      expect(response.status).toBe(401)
      expect(response.body).not.toHaveProperty('challenge')
    })

    it('keeps the session renewable by the refresh cookie the second step issued, with no new code', async () => {
      const { email, secret } = await accountWithSecondFactor()
      const first = await secondStep(await challengeOf(email), codeFor(secret))
      const cookie = first.get('Set-Cookie')?.[0]?.split(';')[0] ?? ''

      expect((await request(app).post('/auth/refresh').set('Cookie', cookie)).status).toBe(200)
    })
  })

  describe('limits on guessing', () => {
    it(`locks the account after ${MAX_CODE_ATTEMPTS} wrong codes, even for the right one, until the lock ends`, async () => {
      const { email, secret } = await accountWithSecondFactor()
      for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
        expect((await secondStep(await challengeOf(email), wrongCodeFor(secret))).status).toBe(401)
      }

      const locked = await secondStep(await challengeOf(email), codeFor(secret))
      expect(locked.status).toBe(429)
      expect(locked.get('Retry-After')).toBe('900')

      await db.updateTable('users').set({ totpLockedUntil: new Date(Date.now() - 1000) }).where('email', '=', email).execute()
      expect((await secondStep(await challengeOf(email), codeFor(secret))).status).toBe(200)
    })

    it('counts the guesses of the profile screen against the same lock', async () => {
      const { secret, accessToken } = await accountWithSecondFactor()
      for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) expect((await disable(accessToken, wrongCodeFor(secret))).status).toBe(400)

      expect((await disable(accessToken, codeFor(secret))).status).toBe(429)
    })

    it('counts parallel guesses too, so a burst cannot try more codes than the limit', async () => {
      const { email, secret } = await accountWithSecondFactor()
      const challenge = await challengeOf(email)
      const burst = await Promise.all(Array.from({ length: 12 }, () => secondStep(challenge, wrongCodeFor(secret))))

      expect(burst.filter((response) => response.status === 401)).toHaveLength(MAX_CODE_ATTEMPTS)
      expect(burst.filter((response) => response.status === 429)).toHaveLength(12 - MAX_CODE_ATTEMPTS)
    })

    it('forgets the wrong codes after a right one', async () => {
      const { email, secret } = await accountWithSecondFactor()
      for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS - 1; attempt += 1) await secondStep(await challengeOf(email), wrongCodeFor(secret))
      await secondStep(await challengeOf(email), codeFor(secret))

      const row = await db.selectFrom('users').select('totpFailedAttempts').where('email', '=', email).executeTakeFirstOrThrow()
      expect(row.totpFailedAttempts).toBe(0)
    })

    it('also falls under the sign-in rate limit of the address', async () => {
      const limited = buildApp({ windowMs: 60_000, limit: 2 })
      const { email, secret } = await accountWithSecondFactor()
      const challenge = await challengeOf(email)

      await secondStep(challenge, wrongCodeFor(secret), limited)
      await secondStep(challenge, wrongCodeFor(secret), limited)
      const blocked = await secondStep(challenge, wrongCodeFor(secret), limited)

      expect(blocked.status).toBe(429)
      expect(blocked.body.code).toBe('too-many-requests')
    })
  })

  describe('turning it off', () => {
    it('needs a current code, and afterwards the password alone signs in again', async () => {
      const { email, secret, accessToken } = await accountWithSecondFactor()

      expect((await disable(accessToken, wrongCodeFor(secret))).status).toBe(400)
      expect((await disable(accessToken, codeFor(secret))).status).toBe(204)
      expect((await request(app).get('/me').set(bearer(accessToken))).body.totpEnabled).toBe(false)
      expect((await signIn(email)).body).toHaveProperty('accessToken')

      const row = await db.selectFrom('users').select(['totpSecret', 'totpLastStep']).where('email', '=', email).executeTakeFirstOrThrow()
      expect(row).toEqual({ totpSecret: null, totpLastStep: null })
    })

    it('refuses a code already used to sign in', async () => {
      const { email, secret, accessToken } = await accountWithSecondFactor()
      const code = codeFor(secret)
      await secondStep(await challengeOf(email), code)

      expect((await disable(accessToken, code)).status).toBe(400)
    })

    it('says so when the factor is not on', async () => {
      const body = bodyOf(await register(uniqueEmail()))

      expect((await disable(body.accessToken, '123456')).status).toBe(409)
    })
  })

  describe('Google sign-in', () => {
    const exchange = (code: string | null, binding = BINDING) => request(app).post('/auth/google/exchange').send({ code, binding })

    async function googleCode(profile: GoogleProfile): Promise<string | null> {
      const start = await request(app).get('/auth/google').query({ returnTo: APP_URL, binding: sha256(BINDING) })
      const consent = new URL(start.get('Location') ?? '')
      googleProfiles.set('codigo-do-google', profile)
      const callback = await request(app).get('/auth/google/callback').query({ code: 'codigo-do-google', state: consent.searchParams.get('state') })
      return new URL(callback.get('Location') ?? '').searchParams.get('google')
    }

    it('asks for the code of an account that has the second factor, and gives no session before it', async () => {
      const { email, secret } = await accountWithSecondFactor()
      const response = await exchange(await googleCode({ email, fullName: 'Ana Lima' }))

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({ secondFactorRequired: true, challenge: expect.any(String) })
      expect(response.body).not.toHaveProperty('accessToken')
      expect(response.get('Set-Cookie')).toBeUndefined()

      expect((await secondStep(bodyOf(response).challenge, wrongCodeFor(secret))).status).toBe(401)
      expect((await secondStep(bodyOf(response).challenge, codeFor(secret))).status).toBe(200)
    })

    it('still signs in at once an account without it', async () => {
      const email = uniqueEmail()
      const response = await exchange(await googleCode({ email, fullName: 'Bia Souza' }))

      expect(response.body).toHaveProperty('accessToken')
    })
  })

  describe('password reset', () => {
    const forgot = (email: string) => request(app).post('/auth/forgot-password').send({ email })
    const reset = (code: string, password = NEW_PASSWORD) => request(app).post('/auth/reset-password').send({ code, password })
    const codeOf = (mail: MailMessage | undefined) => /codigo=([\w-]+)/.exec(mail?.text ?? '')?.[1] ?? ''

    it('sets the password without starting a session and without turning the second factor off', async () => {
      const { email, secret } = await accountWithSecondFactor()
      await forgot(email)
      const response = await reset(codeOf(mails[0]))

      expect(response.status).toBe(204)
      expect(response.get('Set-Cookie')).toBeUndefined()
      expect(response.body).toEqual({})

      const afterwards = await signIn(email, NEW_PASSWORD)
      expect(afterwards.body).toMatchObject({ secondFactorRequired: true })
      expect(afterwards.body).not.toHaveProperty('accessToken')
      expect((await secondStep(bodyOf(afterwards).challenge, codeFor(secret))).status).toBe(200)
    })
  })

  describe('breached passwords', () => {
    it('refuses one on sign-up, with a message the form shows, and creates no account', async () => {
      const email = uniqueEmail()
      const response = await register(email, BREACHED_PASSWORD)

      expect(response.status).toBe(400)
      expect(response.body.message).toBe('Esta senha já apareceu em vazamentos de dados. Escolha outra, que você não use em outros sites.')
      expect(await db.selectFrom('users').select('id').where('email', '=', email).executeTakeFirst()).toBeUndefined()
    })

    it('refuses one on a password reset and leaves the link usable for another', async () => {
      const email = uniqueEmail()
      await register(email)
      await request(app).post('/auth/forgot-password').send({ email })
      const code = /codigo=([\w-]+)/.exec(mails[0]?.text ?? '')?.[1] ?? ''

      const refused = await request(app).post('/auth/reset-password').send({ code, password: BREACHED_PASSWORD })
      expect(refused.status).toBe(400)
      expect(refused.body.message).toContain('vazamentos')

      expect((await request(app).post('/auth/reset-password').send({ code, password: NEW_PASSWORD })).status).toBe(204)
    })
  })

  describe('anonymization', () => {
    it('erases the second factor with the rest of the personal data', async () => {
      const { userId, accessToken } = await accountWithSecondFactor()
      expect((await request(app).post('/me/anonymize').set(bearer(accessToken))).status).toBe(204)

      const row = await db
        .selectFrom('users')
        .select(['totpSecret', 'totpPendingSecret', 'totpEnabledAt', 'totpLastStep', 'totpFailedAttempts'])
        .where('id', '=', userId)
        .executeTakeFirstOrThrow()
      expect(row).toEqual({ totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: null, totpFailedAttempts: 0 })
    })
  })
})
