import { API_ERROR_CODE, ApiError } from './api-error'

/** What `mergePatch` hands back: the values to validate, and which of them the client actually sent. */
export interface MergedPatch<Field extends string> {
  merged: Partial<Record<Field, unknown>>
  sent: Field[]
}

/**
 * Applies a PATCH body to the current values of a form. A field sent replaces
 * the current one, `null` removes it, and anything outside `fields` is ignored,
 * so a body can never reach `status`, `inviteCode` or `teacherId`. The caller
 * validates the result whole with `parseRequest`, so a change is checked
 * together with the fields it did not touch (`docs/Modelo_de_Dados.md`,
 * "Atualização parcial").
 */
export function mergePatch<Field extends string>(
  current: Partial<Record<Field, unknown>>,
  body: unknown,
  fields: readonly Field[],
): MergedPatch<Field> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiError(API_ERROR_CODE.INVALID, 'Dados inválidos.')
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
