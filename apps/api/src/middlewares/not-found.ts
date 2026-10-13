import type { RequestHandler } from 'express'
import { API_ERROR_CODE, ApiError } from '../lib/api-error'

/** Answers an unknown route in the same shape as every other error, instead of Express's HTML page. */
export const notFound: RequestHandler = (_req, _res, next) => {
  next(new ApiError(API_ERROR_CODE.NOT_FOUND, 'Rota não encontrada.'))
}
