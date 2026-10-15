import type { TourScreen } from './content'

/**
 * Outside the `correctio:v1:` prefix of the collections on purpose:
 * `clearAllCollections` wipes that prefix, and a tour the teacher already
 * skipped or finished must not come back because sample data was cleared.
 */
const KEY = 'correctio:tour-seen'

/**
 * Which screens have already shown their tour: finished, skipped, closed on
 * the X or with Esc. A screen in the list never opens its tour by itself
 * again; only the help button of that screen does.
 *
 * Kept in the browser rather than with the account: it is a preference of this
 * device, not a fact about the teacher, and losing it costs four sentences
 * rather than data. Every read is guarded because a private window or blocked
 * storage throws rather than returning nothing.
 */
function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw === null ? [] : (JSON.parse(raw) as string[])
  } catch {
    return []
  }
}

export function hasSeenTour(screen: TourScreen): boolean {
  return read().includes(screen)
}

/**
 * Remembers that a screen showed its tour. With storage unavailable the mark is
 * lost and the tour simply shows again next time, which costs nothing.
 */
export function markTourSeen(screen: TourScreen): void {
  try {
    const seen = read()
    if (seen.includes(screen)) return
    window.localStorage.setItem(KEY, JSON.stringify([...seen, screen]))
  } catch {}
}
