import { createHash, randomBytes } from 'node:crypto'
import { jwtVerify, SignJWT } from 'jose'
import type { UserRole } from '@correctio/domain'

/** Short, so a token that leaks stops working soon; the refresh token renews it (`docs/Seguranca_e_LGPD.md`, section 7). */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60

const ISSUER = 'correctio'
const ACCESS_AUDIENCE = 'correctio-api'

export interface AccessClaims {
  userId: string
  role: UserRole
}

export interface SessionTokens {
  signAccessToken: (claims: AccessClaims) => Promise<string>
  /** `null` for anything that is not a valid, unexpired access token of this API. */
  verifyAccessToken: (token: string) => Promise<AccessClaims | null>
  /** A short-lived signed value, for the state Google hands back after sign-in. */
  signState: (payload: Record<string, string>, ttlSeconds: number) => Promise<string>
  verifyState: (state: string) => Promise<Record<string, unknown> | null>
}

const STATE_AUDIENCE = 'correctio-google-state'

function isRole(value: unknown): value is UserRole {
  return value === 'professor' || value === 'estudante'
}

/** HS256 with `JWT_SECRET`: the API both signs and checks, so a shared secret is all it needs. */
export function createSessionTokens(base64Secret: string): SessionTokens {
  const secret = Buffer.from(base64Secret, 'base64')

  return {
    signAccessToken: ({ userId, role }) =>
      new SignJWT({ role })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(userId)
        .setIssuer(ISSUER)
        .setAudience(ACCESS_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
        .sign(secret),

    async verifyAccessToken(token) {
      try {
        const { payload } = await jwtVerify(token, secret, { issuer: ISSUER, audience: ACCESS_AUDIENCE, algorithms: ['HS256'] })
        if (payload.sub === undefined || !isRole(payload.role)) return null
        return { userId: payload.sub, role: payload.role }
      } catch {
        return null
      }
    },

    signState: (payload, ttlSeconds) =>
      new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer(ISSUER)
        .setAudience(STATE_AUDIENCE)
        .setExpirationTime(`${ttlSeconds}s`)
        .sign(secret),

    async verifyState(state) {
      try {
        const { payload } = await jwtVerify(state, secret, { issuer: ISSUER, audience: STATE_AUDIENCE, algorithms: ['HS256'] })
        return payload
      } catch {
        return null
      }
    },
  }
}

/** A random value only its holder knows: refresh tokens and one-time codes. */
export function createOpaqueToken(): string {
  return randomBytes(32).toString('base64url')
}

/** What is stored in place of an opaque token, so reading the table never yields a usable one. */
export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
