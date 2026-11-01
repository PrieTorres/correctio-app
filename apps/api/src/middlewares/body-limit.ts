import type { Request, RequestHandler } from 'express'
import { API_ERROR_CODE, ApiError } from '../lib/api-error'

/** No route of the API takes more than a form's worth of JSON. */
export const BODY_LIMIT_BYTES = 100 * 1024

function bodySize(req: Request): number {
  if ('rawBody' in req && Buffer.isBuffer(req.rawBody)) return req.rawBody.length
  return Number(req.headers['content-length'] ?? 0)
}

/** The photo of a sheet (#47), the one body that is a file; its route checks it against its own 10 MB (RNF16). */
const PHOTO_UPLOAD = /\/applications\/[^/]+\/sheet-images\/?$/

/** One megabyte more than a photo may have, so the route answers the precise message itself. */
export const PHOTO_BODY_LIMIT_BYTES = 11 * 1024 * 1024

function limitFor(req: Request): number {
  return req.method === 'POST' && PHOTO_UPLOAD.test(req.path) ? PHOTO_BODY_LIMIT_BYTES : BODY_LIMIT_BYTES
}

/**
 * On Firebase the Functions runtime reads and parses the body before Express
 * sees it, with its own 10 MB ceiling, so `express.json` finds the work done
 * and its limit never applies. The size is checked here instead, from the body
 * the runtime kept (`rawBody`) or, locally, from the declared length.
 */
export const limitBodySize: RequestHandler = (req, _res, next) => {
  const limit = limitFor(req)
  if (bodySize(req) <= limit) {
    next()
    return
  }
  next(new ApiError(API_ERROR_CODE.INVALID, limit === BODY_LIMIT_BYTES ? 'A requisição passou do limite de 100 KB.' : 'A foto passou de 10 MB. Tire outra com menos resolução.'))
}
