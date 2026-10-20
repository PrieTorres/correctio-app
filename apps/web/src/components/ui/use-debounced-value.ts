import { useEffect, useState } from 'react'

/** How long typing has to pause before a search goes out, short enough to feel immediate. */
export const SEARCH_DEBOUNCE_MS = 300

/**
 * The value as it was once it stopped changing for `delayMs`.
 *
 * A search box that queries the server on every key sends a request per
 * letter, and the answers can arrive out of order. Reading the term through
 * this hook sends one request when the person pauses. The effect only sets a
 * timer; the request itself stays in the query that reads the value.
 */
export function useDebouncedValue<T>(value: T, delayMs: number = SEARCH_DEBOUNCE_MS): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return settled
}
