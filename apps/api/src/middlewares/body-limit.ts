import type { Request, RequestHandler } from 'express'
import { API_ERROR_CODE, ApiError } from '../lib/api-error'

/** No route of the API takes more than a form's worth of JSON. */
export const BODY_LIMIT_BYTES = 100 * 1024

function bodySize(req: Request): number {
  if ('rawBody' in req && Buffer.isBuffer(req.rawBody)) return req.rawBody.length
  return Number(req.headers['content-length'] ?? 0)
}

/**
 * On Firebase the Functions runtime reads and parses the body before Express
 * sees it, with its own 10 MB ceiling, so `express.json` finds the work done
 * and its limit never applies. The size is checked here instead, from the body
 * the runtime kept (`rawBody`) or, locally, from the declared length.
 */
export const limitBodySize: RequestHandler = (req, _res, next) => {
  if (bodySize(req) <= BODY_LIMIT_BYTES) {
    next()
    return
  }
  next(new ApiError(API_ERROR_CODE.INVALID, 'A requisição passou do limite de 100 KB.'))
}
