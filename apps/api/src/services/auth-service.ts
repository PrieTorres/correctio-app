import { randomUUID } from 'node:crypto'
import { setTimeout as wait } from 'node:timers/promises'
import type { AuthenticatedUser, ForgotPasswordInput, ResetPasswordRequest, SignInInput, SignUpRequest } from '@correctio/domain'
import type { Logger } from 'pino'
import { API_ERROR_CODE, ApiError } from '../lib/api-error'
import { hashPassword, verifyPassword } from '../lib/password'
import { createOpaqueToken, hashOpaqueToken } from '../lib/session-tokens'
import { AUTH_CODE_PURPOSE } from '../models/auth-code-purpose'
import type { AuthCodeRepository } from '../repositories/auth-code-repository'
import type { RefreshTokenRecord, RefreshTokenRepository } from '../repositories/refresh-token-repository'
import type { UserRecord, UserRepository } from '../repositories/user-repository'
import { passwordResetMessage } from './auth-messages'
import type { Mailer } from './mailer'
import { isActiveAccount, toAuthenticatedUser, type IssuedSession, type SessionIssuer } from './session-issuer'

const MINUTE_MS = 60 * 1000

/** Long enough to open the e-mail, short enough that an old message in the inbox is useless. */
const PASSWORD_RESET_TTL_MS = 30 * MINUTE_MS

/**
 * A refresh token presented again within this window after its rotation is a
 * lost response or a second tab, not theft: that request is refused, but the
 * other sessions stay.
 */
export const REUSE_GRACE_MS = 10_000

/**
 * How long `forgot-password` always takes. The API on Firebase gets CPU only
 * while answering, so the e-mail cannot be sent after the response; instead
 * the response waits for a fixed time, and an address with an account takes
 * as long as one without.
 */
export const PASSWORD_RESET_RESPONSE_MS = 2_500

const INVALID_CREDENTIALS = 'E-mail ou senha incorretos.'
const SESSION_ENDED = 'Sua sessão terminou. Entre de novo.'

export interface AuthServiceDependencies {
  users: UserRepository
  refreshTokens: RefreshTokenRepository
  authCodes: AuthCodeRepository
  sessions: SessionIssuer
  mailer: Mailer
  logger: Logger
  /** The fixed address of this environment's web app, which the reset e-mail links to. */
  publicAppUrl: string
  passwordResetResponseMs?: number
}

export interface AuthService {
  register: (input: SignUpRequest, deviceInfo: string | null) => Promise<IssuedSession>
  signIn: (input: SignInInput, deviceInfo: string | null) => Promise<IssuedSession>
  refresh: (refreshToken: string | undefined, deviceInfo: string | null) => Promise<IssuedSession>
  signOut: (refreshToken: string | undefined) => Promise<void>
  signOutEverywhere: (userId: string) => Promise<void>
  requestPasswordReset: (input: ForgotPasswordInput) => Promise<void>
  resetPassword: (input: ResetPasswordRequest) => Promise<void>
  currentUser: (userId: string) => Promise<AuthenticatedUser>
  anonymize: (userId: string) => Promise<void>
}

/**
 * What takes the place of the teacher's name and e-mail (RF05; Spec, Feature
 * 1.1). The name is the one the demo writes; the address carries the whole id
 * because the column is unique, and the `.invalid` domain can never receive
 * mail (RFC 2606).
 */
export const ANONYMIZED_TEACHER_NAME = 'Professor anonimizado'
export const anonymizedTeacherEmail = (userId: string) => `anon-${userId}@removido.invalid`

function sessionEnded(): ApiError {
  return new ApiError(API_ERROR_CODE.UNAUTHORIZED, SESSION_ENDED)
}

export function createAuthService({
  users,
  refreshTokens,
  authCodes,
  sessions,
  mailer,
  logger,
  publicAppUrl,
  passwordResetResponseMs = PASSWORD_RESET_RESPONSE_MS,
}: AuthServiceDependencies): AuthService {
  let decoyHash: Promise<string> | undefined

  /**
   * An unknown address is checked against a throwaway hash, so it takes as long
   * as a wrong password and the response time does not tell which accounts exist.
   */
  const hashToCheck = (user: UserRecord | null): Promise<string> | string => {
    if (user !== null) return user.passwordHash
    decoyHash ??= hashPassword(createOpaqueToken())
    return decoyHash
  }

  /**
   * A revoked token coming back after the grace window means two parties hold
   * it: whoever stole it and the owner. Ending every session of the account
   * throws both out, and the owner signs in again.
   */
  async function reactToReuse(token: RefreshTokenRecord): Promise<void> {
    if (token.revokedAt === null || Date.now() - token.revokedAt.getTime() <= REUSE_GRACE_MS) return
    logger.warn({ userId: token.userId }, 'Refresh token reused: every session of the account was ended')
    await refreshTokens.revokeAllForUser(token.userId)
  }

  async function sendResetLink(email: string): Promise<void> {
    const user = await users.findByEmail(email)
    if (!isActiveAccount(user)) return

    const code = createOpaqueToken()
    await authCodes.create({
      userId: user.id,
      purpose: AUTH_CODE_PURPOSE.PASSWORD_RESET,
      codeHash: hashOpaqueToken(code),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    })
    const link = `${publicAppUrl}/redefinir-senha?codigo=${encodeURIComponent(code)}`
    await mailer.send(passwordResetMessage({ to: user.email, fullName: user.fullName, link }))
  }

  return {
    async register({ fullName, email, password }, deviceInfo) {
      const user = await users.create({ id: randomUUID(), fullName, email, passwordHash: await hashPassword(password), emailVerifiedAt: null })
      if (user === null) throw new ApiError(API_ERROR_CODE.CONFLICT, 'Este e-mail já tem uma conta. Entre com ele ou recupere a senha.')
      return sessions.issue(user, deviceInfo)
    },

    async signIn({ email, password }, deviceInfo) {
      const user = await users.findByEmail(email)
      const passwordMatches = await verifyPassword(await hashToCheck(user), password)
      if (!passwordMatches || !isActiveAccount(user)) throw new ApiError(API_ERROR_CODE.UNAUTHORIZED, INVALID_CREDENTIALS)
      return sessions.issue(user, deviceInfo)
    },

    /**
     * Rotation: the token used is revoked and a new one issued. A token that
     * was already revoked is either a race or a copy (`reactToReuse`).
     */
    async refresh(refreshToken, deviceInfo) {
      const token = refreshToken === undefined ? null : await refreshTokens.findByHash(hashOpaqueToken(refreshToken))
      if (token === null || token.expiresAt.getTime() <= Date.now()) throw sessionEnded()
      if (token.revokedAt !== null) {
        await reactToReuse(token)
        throw sessionEnded()
      }
      if (!(await refreshTokens.revoke(token.id))) throw sessionEnded()

      const user = await users.findById(token.userId)
      if (!isActiveAccount(user)) throw sessionEnded()
      return sessions.issue(user, deviceInfo)
    },

    /** Leaving is never refused: without a valid token there is nothing to revoke, and the cookie goes anyway. */
    async signOut(refreshToken) {
      if (refreshToken === undefined) return
      const token = await refreshTokens.findByHash(hashOpaqueToken(refreshToken))
      if (token !== null) await refreshTokens.revoke(token.id)
    },

    async signOutEverywhere(userId) {
      await refreshTokens.revokeAllForUser(userId)
    },

    /**
     * The same answer whether the address has an account or not (RF03). A
     * failure to send is logged and never reaches the response, which would
     * tell the account exists.
     */
    async requestPasswordReset({ email }) {
      const sending = sendResetLink(email).catch((error: unknown) => {
        logger.error({ err: error }, 'Password reset e-mail was not sent')
      })
      await Promise.all([sending, wait(passwordResetResponseMs)])
    },

    /**
     * The new password is hashed before the code is spent, so a failure there
     * leaves the link usable. Reading the link proves the inbox, and every
     * session ends: whoever knew the old password is out.
     */
    async resetPassword({ code, password }) {
      const passwordHash = await hashPassword(password)
      const userId = await authCodes.consume(hashOpaqueToken(code), AUTH_CODE_PURPOSE.PASSWORD_RESET)
      if (userId === null) throw new ApiError(API_ERROR_CODE.INVALID, 'Este link de redefinição é inválido ou já foi usado. Peça um novo.')

      await users.verifyEmail(userId, passwordHash)
      await refreshTokens.revokeAllForUser(userId)
    },

    async currentUser(userId) {
      const user = await users.findById(userId)
      if (!isActiveAccount(user)) throw sessionEnded()
      return toAuthenticatedUser(user)
    },

    /**
     * RF05: the name and the e-mail go, the password stops working and every
     * session ends. Classes, exams, applications and corrections keep pointing
     * at the same id, so the statistics of every application stay as they
     * were. The password becomes the hash of a secret nobody ever holds, a
     * hash like any other, so signing in with it fails the ordinary way. An
     * account already anonymized has no session to answer to.
     */
    async anonymize(userId) {
      const anonymized = await users.anonymize(userId, {
        fullName: ANONYMIZED_TEACHER_NAME,
        email: anonymizedTeacherEmail(userId),
        passwordHash: await hashPassword(createOpaqueToken()),
        at: new Date(),
      })
      if (!anonymized) throw sessionEnded()
      await refreshTokens.revokeAllForUser(userId)
    },
  }
}
