import type { RequestHandler } from 'express'

/**
 * Every answer of the API is a teacher's or a student's data, so no proxy and
 * no browser disk may keep a copy. The web app keeps what it needs in the
 * TanStack Query cache, in memory, and drops it on sign-out.
 */
export const noStore: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
}
