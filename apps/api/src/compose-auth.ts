import { randomBytes } from 'node:crypto'
import type { Kysely } from 'kysely'
import type { Logger } from 'pino'
import type { AuthComponents } from './app'
import type { Env } from './config/env'
import { createSessionTokens, type SessionTokens } from './lib/session-tokens'
import type { VerifyToken } from './middlewares/require-auth'
import type { Database } from './models/tables'
import { createAuthCodeRepository } from './repositories/auth-code-repository'
import { createRefreshTokenRepository } from './repositories/refresh-token-repository'
import { createUserRepository } from './repositories/user-repository'
import { PUBLIC_API_PATH } from './lib/session-cookie'
import { createAuthService } from './services/auth-service'
import { createGoogleIdentity, type GoogleIdentity } from './services/google-identity'
import { createGoogleSignInService } from './services/google-sign-in-service'
import { createGmailMailer, createLogMailer, type Mailer } from './services/mailer'
import { createSessionIssuer } from './services/session-issuer'

/** Only teachers sign in while the student area is out of scope (`docs/Arquitetura.md`, section 9). */
export function verifierFor(tokens: SessionTokens): VerifyToken {
  return async (token) => {
    const claims = await tokens.verifyAccessToken(token)
    return claims?.role === 'professor' ? { teacherId: claims.userId } : null
  }
}

/**
 * Production refuses to start without `JWT_SECRET` (`config/env.ts`). On a
 * developer's machine a random one per start is enough: a restart invalidates
 * the access tokens, and the refresh cookie, which does not depend on it, gets
 * a new one on the next request.
 */
function signingSecret(env: Env, logger: Logger): string {
  if (env.JWT_SECRET !== undefined) return env.JWT_SECRET
  logger.warn('JWT_SECRET is not set: using a random secret until the API restarts')
  return randomBytes(32).toString('base64')
}

function mailerFor(env: Env, logger: Logger): Mailer {
  if (env.GMAIL_APP_PASSWORD === undefined) return createLogMailer(logger, { production: env.NODE_ENV === 'production' })
  return createGmailMailer({ from: env.MAIL_FROM, appPassword: env.GMAIL_APP_PASSWORD })
}

/** Google returns to one fixed address per environment, the one registered in the Google client. */
function googleFor(env: Env): GoogleIdentity | null {
  if (env.GOOGLE_CLIENT_ID === undefined || env.GOOGLE_CLIENT_SECRET === undefined) return null
  return createGoogleIdentity({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${env.PUBLIC_APP_URL}${PUBLIC_API_PATH}/auth/google/callback`,
  })
}

export interface ComposeAuthOptions {
  env: Env
  db: Kysely<Database>
  logger: Logger
  /** Overridable so tests read the e-mail instead of sending it. */
  mailer?: Mailer
  /** Overridable so tests play Google's part. */
  google?: GoogleIdentity | null
  passwordResetResponseMs?: number
}

/** Builds the sign-in services from the environment, the one place that knows which mailer and which Google client apply. */
export function composeAuth({
  env,
  db,
  logger,
  mailer = mailerFor(env, logger),
  google = googleFor(env),
  passwordResetResponseMs,
}: ComposeAuthOptions): AuthComponents {
  const tokens = createSessionTokens(signingSecret(env, logger))
  const users = createUserRepository(db)
  const refreshTokens = createRefreshTokenRepository(db)
  const authCodes = createAuthCodeRepository(db)
  const sessions = createSessionIssuer({ tokens, refreshTokens })
  const publicAppUrl = env.PUBLIC_APP_URL

  return {
    service: createAuthService({ users, refreshTokens, authCodes, sessions, mailer, logger, publicAppUrl, passwordResetResponseMs }),
    google: createGoogleSignInService({
      identity: google,
      tokens,
      users,
      refreshTokens,
      authCodes,
      sessions,
      logger,
      publicAppUrl,
      corsOrigins: env.CORS_ORIGINS,
    }),
    verifyToken: verifierFor(tokens),
  }
}
