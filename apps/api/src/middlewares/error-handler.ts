import type { ErrorRequestHandler } from 'express'
import type { Logger } from 'pino'
import { API_ERROR_CODE, ApiError } from '../lib/api-error'

const BODY_ERROR_MESSAGE: Readonly<Record<string, string>> = {
  'entity.too.large': 'A requisição passou do limite de 100 KB.',
  'entity.parse.failed': 'O corpo da requisição não é um JSON válido.',
}

function bodyErrorType(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('type' in error)) return undefined
  return typeof error.type === 'string' ? error.type : undefined
}

/**
 * Turns anything thrown into the one error shape the client knows. Body
 * parsing failures are the client's fault and say so; every other unexpected
 * error is logged in full here and reaches the client only as a generic
 * `failure`, never with a stack trace.
 */
function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  const bodyMessage = BODY_ERROR_MESSAGE[bodyErrorType(error) ?? '']
  if (bodyMessage !== undefined) return new ApiError(API_ERROR_CODE.INVALID, bodyMessage, { cause: error })

  return new ApiError(API_ERROR_CODE.FAILURE, 'Erro inesperado. Tente de novo em instantes.', { cause: error })
}

/** Registered last, so it sees what every route and middleware before it throws. */
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error, _req, res, _next) => {
    const apiError = toApiError(error)
    if (apiError.code === API_ERROR_CODE.FAILURE) logger.error({ err: error }, 'Unexpected error')
    if (apiError.retryAfterSeconds !== undefined) res.set('Retry-After', String(apiError.retryAfterSeconds))

    res.status(apiError.status).json({ code: apiError.code, message: apiError.message })
  }
}
