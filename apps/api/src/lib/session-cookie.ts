import { parseCookie } from 'cookie'
import type { CookieOptions, Request, Response } from 'express'

/**
 * Firebase Hosting forwards only the cookie named `__session` to the function
 * and drops every other one, so the refresh token has to live under this name.
 */
export const SESSION_COOKIE = '__session'

/** Where the browser reaches the API on every host: Hosting's rewrite and the Vite proxy both serve it at `/api`. */
export const PUBLIC_API_PATH = '/api'

/**
 * `httpOnly` keeps it out of reach of any script on the page, `SameSite=Strict`
 * keeps another site from making the browser send it, and the path sends it to
 * the sign-in routes only, never with the rest of the API.
 *
 * `secure` follows the address of the web app: required on the published
 * sites, off on `http://localhost`, where some browsers refuse a secure cookie.
 */
function cookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'strict', path: `${PUBLIC_API_PATH}/auth` }
}

export interface SessionCookie {
  set: (res: Response, refreshToken: string) => void
  clear: (res: Response) => void
  read: (req: Request) => string | undefined
}

export function createSessionCookie({ secure, maxAgeMs }: { secure: boolean; maxAgeMs: number }): SessionCookie {
  return {
    set(res, refreshToken) {
      res.cookie(SESSION_COOKIE, refreshToken, { ...cookieOptions(secure), maxAge: maxAgeMs })
    },
    clear(res) {
      res.clearCookie(SESSION_COOKIE, cookieOptions(secure))
    },
    read(req) {
      const header = req.get('cookie')
      return header === undefined ? undefined : parseCookie(header)[SESSION_COOKIE]
    },
  }
}
