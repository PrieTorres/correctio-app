import type { RequestHandler, Response } from 'express'
import { API_ERROR_CODE, ApiError } from '../lib/api-error'

export interface AuthenticatedTeacher {
  teacherId: string
}

/**
 * Turns a bearer token into the teacher it belongs to, or `null` when it is not
 * valid. Injected rather than imported, so tests of other routes hand in fixed
 * tokens; the real check is `verifierFor` in `compose-auth.ts`.
 */
export type VerifyToken = (token: string) => Promise<AuthenticatedTeacher | null>

/** The default without sign-in services: nothing is authenticated, so every protected route answers 401. */
export const rejectAllTokens: VerifyToken = () => Promise.resolve(null)

const BEARER = /^Bearer (\S+)$/
const SIGN_IN_REQUIRED = 'Faça login para continuar.'

/**
 * Puts the teacher of a valid token on `res.locals`. Services read the owner
 * from there and never from the request body (`docs/Seguranca_e_LGPD.md`).
 */
export function createRequireAuth(verifyToken: VerifyToken): RequestHandler {
  return async (req, res, next) => {
    const token = BEARER.exec(req.get('authorization') ?? '')?.[1]
    const teacher = token === undefined ? null : await verifyToken(token)
    if (teacher === null) throw new ApiError(API_ERROR_CODE.UNAUTHORIZED, SIGN_IN_REQUIRED)

    res.locals.teacherId = teacher.teacherId
    next()
  }
}

/** The teacher `requireAuth` identified, for a controller to hand to its service. */
export function currentTeacherId(res: Response): string {
  const teacherId: unknown = res.locals.teacherId
  if (typeof teacherId !== 'string') throw new ApiError(API_ERROR_CODE.UNAUTHORIZED, SIGN_IN_REQUIRED)
  return teacherId
}