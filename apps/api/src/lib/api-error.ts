/**
 * The error codes the API answers with. The first four are the ones the web
 * app already handles in `StorageErrorCode` (`apps/web/src/lib/storage/errors.ts`),
 * so the HTTP adapter maps them without translation.
 */
export const API_ERROR_CODE = Object.freeze({
  NOT_FOUND: 'not-found',
  INVALID: 'invalid',
  CONFLICT: 'conflict',
  FAILURE: 'failure',
  UNAUTHORIZED: 'unauthorized',
  TOO_MANY_REQUESTS: 'too-many-requests',
} as const)

export type ApiErrorCode = (typeof API_ERROR_CODE)[keyof typeof API_ERROR_CODE]

const STATUS_BY_CODE: Readonly<Record<ApiErrorCode, number>> = {
  [API_ERROR_CODE.NOT_FOUND]: 404,
  [API_ERROR_CODE.INVALID]: 400,
  [API_ERROR_CODE.CONFLICT]: 409,
  [API_ERROR_CODE.FAILURE]: 500,
  [API_ERROR_CODE.UNAUTHORIZED]: 401,
  [API_ERROR_CODE.TOO_MANY_REQUESTS]: 429,
}

interface ApiErrorOptions {
  cause?: unknown
  /** Seconds the client should wait, sent as `Retry-After` on a 429. */
  retryAfterSeconds?: number
}

/**
 * An error the client is meant to see. `message` is shown on screen as it
 * arrives (`SaveError` in the web app), so it is written in Portuguese.
 * Anything that is not an `ApiError` is treated as unexpected and never
 * reaches the client in detail.
 */
export class ApiError extends Error {
  readonly retryAfterSeconds: number | undefined

  constructor(
    readonly code: ApiErrorCode,
    message: string,
    options: ApiErrorOptions = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'ApiError'
    this.retryAfterSeconds = options.retryAfterSeconds
  }

  get status(): number {
    return STATUS_BY_CODE[this.code]
  }
}
