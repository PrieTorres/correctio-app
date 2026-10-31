import {
  forgotPasswordSchema,
  googleExchangeSchema,
  resetPasswordRequestSchema,
  signInSchema,
  signUpRequestSchema,
} from '@correctio/domain'
import type { Request, RequestHandler, Response } from 'express'
import { parseRequest } from '../lib/parse-request'
import type { SessionCookie } from '../lib/session-cookie'
import { currentTeacherId } from '../middlewares/require-auth'
import type { AuthService } from '../services/auth-service'
import type { GoogleSignInService } from '../services/google-sign-in-service'
import type { IssuedSession } from '../services/session-issuer'

const DEVICE_INFO_MAX_LENGTH = 255

/** The browser's user agent, cut to the column (`RefreshToken.deviceInfo`). */
function deviceOf(req: Request): string | null {
  return req.get('user-agent')?.slice(0, DEVICE_INFO_MAX_LENGTH) ?? null
}

function queryText(req: Request, name: string): string | undefined {
  const value: unknown = req.query[name]
  return typeof value === 'string' ? value : undefined
}

export interface AuthControllerDependencies {
  auth: AuthService
  google: GoogleSignInService
  cookie: SessionCookie
}

export type AuthController = Record<
  | 'register'
  | 'signIn'
  | 'refresh'
  | 'signOut'
  | 'signOutEverywhere'
  | 'forgotPassword'
  | 'resetPassword'
  | 'me'
  | 'anonymize'
  | 'googleStart'
  | 'googleCallback'
  | 'googleExchange',
  RequestHandler
>

/**
 * Express 5 forwards a rejected handler to the error middleware on its own,
 * so the handlers only translate between HTTP and the services.
 */
export function createAuthController({ auth, google, cookie }: AuthControllerDependencies): AuthController {
  /** The refresh token goes to the cookie only; the body carries what the page may hold in memory. */
  const sendSession = (res: Response, { refreshToken, ...session }: IssuedSession, status = 200) => {
    cookie.set(res, refreshToken)
    res.status(status).json(session)
  }

  const endSession = (res: Response) => {
    cookie.clear(res)
    res.status(204).end()
  }

  return {
    async register(req, res) {
      sendSession(res, await auth.register(parseRequest(signUpRequestSchema, req.body), deviceOf(req)), 201)
    },

    async signIn(req, res) {
      sendSession(res, await auth.signIn(parseRequest(signInSchema, req.body), deviceOf(req)))
    },

    /** A refused refresh also drops the cookie, so the browser stops offering a token that will never work. */
    async refresh(req, res) {
      try {
        sendSession(res, await auth.refresh(cookie.read(req), deviceOf(req)))
      } catch (error) {
        cookie.clear(res)
        throw error
      }
    },

    async signOut(req, res) {
      await auth.signOut(cookie.read(req))
      endSession(res)
    },

    async signOutEverywhere(_req, res) {
      await auth.signOutEverywhere(currentTeacherId(res))
      endSession(res)
    },

    async forgotPassword(req, res) {
      await auth.requestPasswordReset(parseRequest(forgotPasswordSchema, req.body))
      res.status(204).end()
    },

    async resetPassword(req, res) {
      await auth.resetPassword(parseRequest(resetPasswordRequestSchema, req.body))
      res.status(204).end()
    },

    async me(_req, res) {
      res.json(await auth.currentUser(currentTeacherId(res)))
    },

    /** Ends this browser's session too, like `logout-all`: the account is no one's to sign in to any more. */
    async anonymize(_req, res) {
      await auth.anonymize(currentTeacherId(res))
      endSession(res)
    },

    async googleStart(req, res) {
      res.redirect(await google.start({ returnTo: queryText(req, 'returnTo') ?? '', bindingHash: queryText(req, 'binding') ?? '' }))
    },

    async googleCallback(req, res) {
      res.redirect(await google.finish({ code: queryText(req, 'code'), state: queryText(req, 'state') }))
    },

    async googleExchange(req, res) {
      sendSession(res, await google.exchange(parseRequest(googleExchangeSchema, req.body), deviceOf(req)))
    },
  }
}
