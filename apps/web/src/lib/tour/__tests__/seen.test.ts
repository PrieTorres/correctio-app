import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hasSeenTour, markTourSeen, resetAllTours } from '../seen'

describe('tour state', () => {
  beforeEach(() => window.localStorage.clear())

  it('has seen nothing before anything is opened', () => {
    expect(hasSeenTour('dashboard')).toBe(false)
  })

  it('remembers a screen once its tour has run', () => {
    markTourSeen('dashboard')

    expect(hasSeenTour('dashboard')).toBe(true)
  })

  it('keeps one screen apart from another', () => {
    markTourSeen('dashboard')

    expect(hasSeenTour('exams')).toBe(false)
  })

  it('does not store the same screen twice', () => {
    markTourSeen('dashboard')
    markTourSeen('dashboard')

    expect(window.localStorage.getItem('correctio:v1:tour-seen')).toBe('["dashboard"]')
  })

  /** What "rever tour" in the profile does. */
  it('forgets every screen at once', () => {
    markTourSeen('dashboard')
    markTourSeen('exams')

    resetAllTours()

    expect(hasSeenTour('dashboard')).toBe(false)
    expect(hasSeenTour('exams')).toBe(false)
  })

  it('reports nothing seen when storage is unreadable, rather than throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(hasSeenTour('dashboard')).toBe(false)
  })

  it('leaves the app standing when storage refuses a write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(() => markTourSeen('dashboard')).not.toThrow()
  })

  it('leaves the app standing when storage refuses a clear', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(() => resetAllTours()).not.toThrow()
  })
})
