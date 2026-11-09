import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Brings the element the address points at (`#notas`) into view and puts the
 * focus on it, once `ready`. React Router does not scroll to a hash, and the
 * element only settles in place after the screen's data arrives, so a link
 * from the panel straight to "Liberar as notas" (#202) would land at the top.
 * The page itself is the outside system this effect follows.
 */
export function useHashTarget(ready: boolean): void {
  const { hash } = useLocation()

  useEffect(() => {
    if (!ready || hash === '') return
    const target = document.getElementById(decodeURIComponent(hash.slice(1)))
    if (target === null) return
    target.scrollIntoView({ block: 'start' })
    target.focus({ preventScroll: true })
  }, [hash, ready])
}
