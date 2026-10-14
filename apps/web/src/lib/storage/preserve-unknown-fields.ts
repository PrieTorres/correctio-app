/**
 * Re-attaches the keys Zod dropped, letting validated values win for the keys
 * the schema does own.
 *
 * `z.object()` strips what it does not declare, and a record read through a
 * schema must not lose a field it carried: a newer client or the API may know
 * fields this version does not. Validation checks the known shape; it is never
 * the reason a value disappears. Shared by the local collection and the HTTP
 * repository, so both sides keep the same rule.
 */
export function preserveUnknownFields<T>(raw: unknown, validated: T): T {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return validated
  return { ...raw, ...validated }
}
