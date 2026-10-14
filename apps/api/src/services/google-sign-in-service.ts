import { randomUUID } from 'node:crypto'
import type { GoogleExchange } from '@correctio/domain'
import type { Logger } from 'pino'
import { z } from 'zod'
import { API_ERROR_CODE, ApiError } from '../lib/api-error'
import { unusablePasswordHash } from '../lib/password'
import { createOpaqueToken, hashOpaqueToken, type SessionTokens } from '../lib/session-tokens'
import { AUTH_CODE_PURPOSE } from '../models/auth-code-purpose'
import type { AuthCodeRepository } from '../repositories/auth-code-repository'
import type { RefreshTokenRepository } from '../repositories/refresh-token-repository'
import type { UserRecord, UserRepository } from '../repositories/user-repository'
import type { GoogleIdentity, GoogleProfile } from './google-identity'
import type { IssuedSession, SessionIssuer } from './session-issuer'

/** Time to pick an account on Google's screen. */
const STATE_TTL_SECONDS = 10 * 60
/** The code only travels from the callback to the page that exchanges it, a matter of seconds. */
const SIGN_IN_CODE_TTL_MS = 2 * 60 * 1000

const SHA256_HEX = /^[0-9a-f]{64}$/

/** What travels inside the signed `state`: where to go back to, and the hash of the starting browser's secret. */
const flowSchema = z.object({ returnTo: z.string(), bindingHash: z.string().regex(SHA256_HEX) })
type Flow = z.infer<typeof flowSchema>

export interface GoogleStart {
  /** The origin of the page that started, which may be a preview link of a branch. */
  returnTo: string
  /** SHA-256 of a random value that only the starting browser keeps. */
  bindingHash: string
}

export interface GoogleCallback {
  code?: string
  state?: string
}

export interface GoogleSignInService {
  /** Google's consent screen, or the sign-in page with an error when Google is not configured here. */
  start: (request: GoogleStart) => Promise<string>
  /** Back on the sign-in page that started, with a one-time code or an error. */
  finish: (callback: GoogleCallback) => Promise<string>
  exchange: (input: GoogleExchange, deviceInfo: string | null) => Promise<IssuedSession>
}

export interface GoogleSignInDependencies {
  /** `null` when this environment has no Google client: the button then ends on an error instead of a broken page. */
  identity: GoogleIdentity | null
  tokens: SessionTokens
  users: UserRepository
  refreshTokens: RefreshTokenRepository
  authCodes: AuthCodeRepository
  sessions: SessionIssuer
  logger: Logger
  publicAppUrl: string
  corsOrigins: readonly string[]
}

const FIREBASE_SITE = /^https:\/\/([a-z0-9-]+)\.web\.app$/

/** `https://<site>--<channel>.web.app`, the address Firebase gives each preview link of a site. */
function isPreviewOf(origin: string, siteOrigin: string): boolean {
  const site = FIREBASE_SITE.exec(siteOrigin)?.[1]
  return site !== undefined && new RegExp(`^https://${site}--[a-z0-9-]+\\.web\\.app$`).test(origin)
}

/**
 * Where a Google sign-in may return to: this environment's own addresses and
 * its preview links. Anything else would let a link send the sign-in code to
 * someone else's site.
 */
export function isAllowedReturnOrigin(origin: string, { publicAppUrl, corsOrigins }: { publicAppUrl: string; corsOrigins: readonly string[] }): boolean {
  return origin === publicAppUrl || corsOrigins.includes(origin) || isPreviewOf(origin, publicAppUrl)
}

/**
 * The stored hash covers the code and the browser's secret together, so the
 * code alone is useless: a sign-in code sent to someone else's browser cannot
 * be exchanged there, which stops an attacker from signing a victim into the
 * attacker's account.
 */
export function signInCodeHash(code: string, bindingHash: string): string {
  return hashOpaqueToken(`${code}:${bindingHash}`)
}

function signInPage(origin: string, params: Record<string, string>): string {
  return `${origin}/entrar?${new URLSearchParams(params).toString()}`
}

const FAILED = { erro: 'google' }

export function createGoogleSignInService(deps: GoogleSignInDependencies): GoogleSignInService {
  const { identity, tokens, users, refreshTokens, authCodes, sessions, logger, publicAppUrl } = deps

  async function readFlow(state: string | undefined): Promise<Flow | null> {
    const payload = state === undefined ? null : await tokens.verifyState(state)
    const flow = flowSchema.safeParse(payload)
    return flow.success ? flow.data : null
  }

  async function createAccount({ email, fullName }: GoogleProfile): Promise<UserRecord | null> {
    const passwordHash = await unusablePasswordHash()
    const created = await users.create({ id: randomUUID(), fullName, email, passwordHash, emailVerifiedAt: new Date() })
    return created ?? users.findByEmail(email)
  }

  /**
   * The same address is always the same account. An account nobody has proved
   * the inbox of may have been created by someone who typed this person's
   * address: its password stops working and its sessions end, so only the
   * owner of the inbox stays in.
   */
  async function accountFor(profile: GoogleProfile): Promise<UserRecord | null> {
    const existing = await users.findByEmail(profile.email)
    if (existing === null) return createAccount(profile)
    if (existing.emailVerifiedAt === null) {
      await users.verifyEmail(existing.id, await unusablePasswordHash())
      await refreshTokens.revokeAllForUser(existing.id)
    }
    return existing
  }

  async function signInCode(googleCode: string, bindingHash: string): Promise<string | null> {
    const profile = identity === null ? null : await identity.identify(googleCode)
    const user = profile === null ? null : await accountFor(profile)
    if (user === null || user.anonymizedAt !== null) return null

    const code = createOpaqueToken()
    await authCodes.create({
      userId: user.id,
      purpose: AUTH_CODE_PURPOSE.GOOGLE_SIGN_IN,
      codeHash: signInCodeHash(code, bindingHash),
      expiresAt: new Date(Date.now() + SIGN_IN_CODE_TTL_MS),
    })
    return code
  }

  return {
    async start({ returnTo, bindingHash }) {
      if (!isAllowedReturnOrigin(returnTo, deps) || !SHA256_HEX.test(bindingHash)) {
        throw new ApiError(API_ERROR_CODE.INVALID, 'Endereço de retorno do login com o Google inválido.')
      }
      if (identity === null) return signInPage(returnTo, FAILED)
      return identity.authorizationUrl(await tokens.signState({ returnTo, bindingHash }, STATE_TTL_SECONDS))
    },

    /**
     * Without a valid `state` there is no trusted address to go back to, so
     * the browser lands on this environment's own sign-in page.
     */
    async finish({ code, state }) {
      const flow = await readFlow(state)
      if (flow === null) return signInPage(publicAppUrl, FAILED)

      try {
        const oneTimeCode = code === undefined ? null : await signInCode(code, flow.bindingHash)
        return signInPage(flow.returnTo, oneTimeCode === null ? FAILED : { google: oneTimeCode })
      } catch (error) {
        logger.error({ err: error }, 'Google sign-in failed')
        return signInPage(flow.returnTo, FAILED)
      }
    },

    async exchange({ code, binding }, deviceInfo) {
      const userId = await authCodes.consume(signInCodeHash(code, hashOpaqueToken(binding)), AUTH_CODE_PURPOSE.GOOGLE_SIGN_IN)
      const user = userId === null ? null : await users.findById(userId)
      if (user === null || user.anonymizedAt !== null) {
        throw new ApiError(API_ERROR_CODE.UNAUTHORIZED, 'O login com o Google não foi concluído. Tente de novo.')
      }
      return sessions.issue(user, deviceInfo)
    },
  }
}
