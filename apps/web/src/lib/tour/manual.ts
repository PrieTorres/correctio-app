import { useSyncExternalStore } from 'react'

/**
 * Lets the help button in the layout reopen the tour a page is rendering.
 *
 * The button and the tour are on opposite sides of the router outlet, and the
 * request is a moment rather than a value, so neither props nor context fit.
 * A tiny external store read with `useSyncExternalStore` is what React offers
 * for exactly this, and it keeps the tour component free of any knowledge that
 * a help button exists.
 */
let requests = 0
const listeners = new Set<() => void>()

export function requestTour(): void {
  requests += 1
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Increments every time help is asked for, so a page can react to the change. */
export function useTourRequests(): number {
  return useSyncExternalStore(
    subscribe,
    () => requests,
    () => 0,
  )
}
