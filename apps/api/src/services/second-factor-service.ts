import { SIGN_IN_STATUS, type TotpSetup } from '@correctio/domain'
import QRCode from 'qrcode'
import type { Logger } from 'pino'
import { API_ERROR_CODE, ApiError } from '../lib/api-error'
import type { FieldCipher } from '../lib/field-encryption'
import type { SessionTokens } from '../lib/session-tokens'
import { generateTotpSecret, matchTotp, totpUri } from '../lib/totp'
import type { SecondFactorRepository } from '../repositories/second-factor-repository'
import type { UserRecord, UserRepository } from '../repositories/user-repository'
import { isActiveAccount, type IssuedSession, type SessionIssuer } from './session-issuer'

const MINUTE_MS = 60 * 1000

/** Time to open the authenticator app after typing the password. */
export const CHALLENGE_TTL_SECONDS = 5 * 60

/** Wrong codes an account tolerates before the second factor locks. */
export const MAX_CODE_ATTEMPTS = 5

/** How long a locked second factor refuses every code, the same window as the sign-in limit. */
export const CODE_LOCK_MS = 15 * MINUTE_MS

const LOCKED = 'Muitas tentativas de código. Aguarde 15 minutos e tente de novo.'
const CHALLENGE_ENDED = 'A confirmação expirou. Entre de novo com e-mail e senha.'
const SIGN_IN_CODE_REFUSED = 'Código incorreto ou já usado. Digite o código atual do aplicativo.'
const CODE_REFUSED = 'Código incorreto ou já usado. Digite o código atual do aplicativo e tente de novo.'

/** The first step of a sign-in ends in a session, or, for an account with a second factor, in a challenge for the second step. */
export type SignInOutcome =
  | { status: typeof SIGN_IN_STATUS.SIGNED_IN; session: IssuedSession }
  | { status: typeof SIGN_IN_STATUS.SECOND_FACTOR; challenge: string; expiresIn: number }

export interface SecondFactorService {
  /**
   * The one place every way of signing in passes through after proving the
   * first factor: password and Google alike. An account without a second
   * factor gets its session; one with it gets a challenge instead.
   */
  admit: (user: UserRecord, deviceInfo: string | null) => Promise<SignInOutcome>
  /** Trades the challenge and a current code for the session. */
  completeSignIn: (challenge: string, code: string, deviceInfo: string | null) => Promise<IssuedSession>
  /** Starts enrolment with a new pending secret; the factor stays off until `enable` receives a code. */
  beginSetup: (userId: string) => Promise<TotpSetup>
  enable: (userId: string, code: string) => Promise<void>
  disable: (userId: string, code: string) => Promise<void>
}

export interface SecondFactorDependencies {
  users: UserRepository
  secondFactors: SecondFactorRepository
  sessions: SessionIssuer
  tokens: SessionTokens
  cipher: FieldCipher
  logger: Logger
  /** Overridable so tests move through the time steps without waiting. */
  now?: () => number
  /** Draws the QR Code as a `data:` URL; overridable so tests need no image. */
  drawQrCode?: (text: string) => Promise<string>
}

async function drawSvgQrCode(text: string): Promise<string> {
  const svg = await QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

function sessionRequired(): ApiError {
  return new ApiError(API_ERROR_CODE.UNAUTHORIZED, 'Sua sessão terminou. Entre de novo.')
}

export function createSecondFactorService({
  users,
  secondFactors,
  sessions,
  tokens,
  cipher,
  logger,
  now = Date.now,
  drawQrCode = drawSvgQrCode,
}: SecondFactorDependencies): SecondFactorService {
  /**
   * Spends one attempt, then matches the code. The attempt is reserved before
   * the comparison so a burst of parallel guesses is counted too, and given
   * back only by a code that is right.
   *
   * @returns The matched time step, or `null` for a wrong code.
   */
  async function matchCode(userId: string, secret: string, code: string): Promise<number | null> {
    const moment = now()
    const reserved = await secondFactors.reserveAttempt(userId, { maxAttempts: MAX_CODE_ATTEMPTS, lockMs: CODE_LOCK_MS, now: new Date(moment) })
    if (!reserved) {
      logger.warn({ userId }, 'Second factor locked after repeated wrong codes')
      throw new ApiError(API_ERROR_CODE.TOO_MANY_REQUESTS, LOCKED, { retryAfterSeconds: CODE_LOCK_MS / 1000 })
    }
    return matchTotp(secret, code, moment)
  }

  /** A code is good once: a step no newer than the last accepted one is a replay, however right the digits are. */
  async function assertFreshCode(userId: string, secret: string, code: string, refusal: ApiError): Promise<void> {
    const step = await matchCode(userId, secret, code)
    if (step === null || !(await secondFactors.acceptStep(userId, step))) throw refusal
    await secondFactors.clearAttempts(userId)
  }

  async function confirmedSecret(userId: string): Promise<string> {
    const record = await secondFactors.find(userId)
    if (record?.secret == null) throw new ApiError(API_ERROR_CODE.CONFLICT, 'A verificação em duas etapas não está ativa nesta conta.')
    return cipher.decrypt(record.secret)
  }

  return {
    async admit(user, deviceInfo) {
      if (user.totpEnabledAt === null) return { status: SIGN_IN_STATUS.SIGNED_IN, session: await sessions.issue(user, deviceInfo) }
      return { status: SIGN_IN_STATUS.SECOND_FACTOR, challenge: await tokens.signSecondFactorChallenge(user.id, CHALLENGE_TTL_SECONDS), expiresIn: CHALLENGE_TTL_SECONDS }
    },

    async completeSignIn(challenge, code, deviceInfo) {
      const userId = await tokens.verifySecondFactorChallenge(challenge)
      const user = userId === null ? null : await users.findById(userId)
      if (!isActiveAccount(user) || user.totpEnabledAt === null) throw new ApiError(API_ERROR_CODE.UNAUTHORIZED, CHALLENGE_ENDED)

      await assertFreshCode(user.id, await confirmedSecret(user.id), code, new ApiError(API_ERROR_CODE.UNAUTHORIZED, SIGN_IN_CODE_REFUSED))
      return sessions.issue(user, deviceInfo)
    },

    async beginSetup(userId) {
      const user = await users.findById(userId)
      if (!isActiveAccount(user)) throw sessionRequired()

      const secret = generateTotpSecret()
      if (!(await secondFactors.savePending(userId, cipher.encrypt(secret)))) {
        throw new ApiError(API_ERROR_CODE.CONFLICT, 'A verificação em duas etapas já está ativa. Desative antes de configurar de novo.')
      }
      const otpauthUri = totpUri(secret, user.email)
      return { secret, otpauthUri, qrCodeDataUrl: await drawQrCode(otpauthUri) }
    },

    async enable(userId, code) {
      const record = await secondFactors.find(userId)
      if (record?.pendingSecret == null) {
        throw new ApiError(API_ERROR_CODE.CONFLICT, 'Gere o QR Code antes de confirmar o código.')
      }
      const step = await matchCode(userId, cipher.decrypt(record.pendingSecret), code)
      if (step === null || !(await secondFactors.enable(userId, step, new Date(now())))) {
        throw new ApiError(API_ERROR_CODE.INVALID, CODE_REFUSED)
      }
      await secondFactors.clearAttempts(userId)
    },

    async disable(userId, code) {
      await assertFreshCode(userId, await confirmedSecret(userId), code, new ApiError(API_ERROR_CODE.INVALID, CODE_REFUSED))
      await secondFactors.disable(userId)
    },
  }
}
