/**
 * The message react-hook-form puts on a field array as a whole.
 *
 * A rule about the array rather than about one of its items — "fill in every
 * alternative", "at most twenty questions" — lands under `root` once the items
 * are registered, and directly on the field before that. Reading only one of
 * the two is how a form comes to refuse a save and say nothing at all, which is
 * exactly what the question form was doing.
 */
export function fieldArrayMessage(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined

  const asRecord = error as { message?: unknown; root?: { message?: unknown } }
  const message = asRecord.root?.message ?? asRecord.message

  return typeof message === 'string' ? message : undefined
}
