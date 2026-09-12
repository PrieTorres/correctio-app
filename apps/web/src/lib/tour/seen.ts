import type { TourScreen } from './content'

const KEY = 'correctio:v1:tour-seen'

/**
 * Which screens have already shown their tour.
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

export function markTourSeen(screen: TourScreen): void {
  try {
    const seen = read()
    if (seen.includes(screen)) return
    window.localStorage.setItem(KEY, JSON.stringify([...seen, screen]))
  } catch {
    /* Storage unavailable: the tour simply shows again next time. */
  }
}

/** Clears every screen, which is what "rever tour" in the profile does. */
export function resetAllTours(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* Nothing to clear when storage is unavailable. */
  }
}
