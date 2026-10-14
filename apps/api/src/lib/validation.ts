import type { ZodType, ZodTypeDef } from 'zod'
import { API_ERROR_CODE, ApiError } from './api-error'

/**
 * Validates what a client sent with a schema of `@correctio/domain`, the same one
 * the screens validate with, and answers 400 naming the first field it refused.
 * `subject` names the whole in the message, such as "Dados da turma".
 */
export function parseInput<Output>(schema: ZodType<Output, ZodTypeDef, unknown>, value: unknown, subject: string): Output {
  const result = schema.safeParse(value)
  if (result.success) return result.data

  const field = result.error.issues[0]?.path.join('.') || 'corpo da requisição'
  throw new ApiError(API_ERROR_CODE.INVALID, `${subject} inválidos: ${field}.`)
}

/** What `mergePatch` hands back: the values to validate, and which of them the client actually sent. */
export interface MergedPatch<Field extends string> {
  merged: Partial<Record<Field, unknown>>
  sent: Field[]
}

/**
 * Applies a PATCH body to the current values of a form. A field sent replaces
 * the current one, `null` removes it, and anything outside `fields` is ignored,
 * so a body can never reach `status`, `inviteCode` or `teacherId`. The result is
 * validated whole, so a change is checked together with the fields it did not
 * touch (`docs/Modelo_de_Dados.md`, "Atualização parcial").
 */
export function mergePatch<Field extends string>(
  current: Partial<Record<Field, unknown>>,
  body: unknown,
  fields: readonly Field[],
  subject: string,
): MergedPatch<Field> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiError(API_ERROR_CODE.INVALID, `${subject} inválidos: corpo da requisição.`)
  }

  const changes: Record<string, unknown> = { ...body }
  const sent = fields.filter((field) => field in changes)
  const merged: Partial<Record<Field, unknown>> = { ...current }
  for (const field of sent) {
    if (changes[field] === null) delete merged[field]
    else merged[field] = changes[field]
  }
  return { merged, sent }
}
