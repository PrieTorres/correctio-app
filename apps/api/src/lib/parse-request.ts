import type { ZodType } from 'zod'
import { API_ERROR_CODE, ApiError } from './api-error'

/**
 * Validates what the client sent against a schema of `@correctio/domain`. The
 * refusal carries the schema's own message, already written for the screen,
 * so the form and the API say the same thing about the same mistake.
 */
export function parseRequest<Output>(schema: ZodType<Output, unknown>, input: unknown): Output {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  throw new ApiError(API_ERROR_CODE.INVALID, result.error.issues[0]?.message ?? 'Dados inválidos.')
}
