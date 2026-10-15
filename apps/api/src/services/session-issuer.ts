import { randomUUID } from 'node:crypto'
import type { AuthenticatedUser } from '@correctio/domain'
import { ACCESS_TOKEN_TTL_SECONDS, createOpaqueToken, hashOpaqueToken, type SessionTokens } from '../lib/session-tokens'
import type { RefreshTokenRepository } from '../repositories/refresh-token-repository'
import type { UserRecord } from '../repositories/user-repository'

const DAY_MS = 24 * 60 * 60 * 1000

/** How long a device stays signed in without use; every refresh starts the count again. */
export const REFRESH_TOKEN_TTL_MS = 30 * DAY_MS

export interface IssuedSession {
  user: AuthenticatedUser
  accessToken: string
  expiresIn: number
  /** Goes to the `httpOnly` cookie, never to the response body. */
  refreshToken: string
}

export interface SessionIssuer {
  /** `deviceInfo` is the browser's user agent, so the teacher can tell sessions apart. */
  issue: (user: UserRecord, deviceInfo: string | null) => Promise<IssuedSession>
}

/** Only an account that exists and was not anonymized gets a session (Spec, Feature 1.1). */
export function isActiveAccount(user: UserRecord | null): user is UserRecord {
  return user?.anonymizedAt === null
}

/** The entity minus the server secret, with dates as the strings the domain schema expects. */
export function toAuthenticatedUser(user: UserRecord): AuthenticatedUser {
  return {
    id: user.id,
    role: user.role,
    fullName: user.fullName,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    ...(user.anonymizedAt === null ? {} : { anonymizedAt: user.anonymizedAt.toISOString() }),
  }
}

/** Every way in, password or Google, ends here, so all of them hand out the same kind of session. */
export function createSessionIssuer({ tokens, refreshTokens }: { tokens: SessionTokens; refreshTokens: RefreshTokenRepository }): SessionIssuer {
  return {
    async issue(user, deviceInfo) {
      const refreshToken = createOpaqueToken()
      await refreshTokens.create({
        id: randomUUID(),
        userId: user.id,
        tokenHash: hashOpaqueToken(refreshToken),
        deviceInfo,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      })
      const accessToken = await tokens.signAccessToken({ userId: user.id, role: user.role })
      return { user: toAuthenticatedUser(user), accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS, refreshToken }
    },
  }
}
