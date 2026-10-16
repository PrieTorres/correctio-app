import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAllCollections } from '@/lib/storage/collection'
import { hasSeenTour, markTourSeen } from '../seen'

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

    expect(window.localStorage.getItem('correctio:tour-seen')).toBe('["dashboard"]')
  })

  it('survives clearing the data, so a dismissed tour stays dismissed', () => {
    markTourSeen('dashboard')

    clearAllCollections()

    expect(hasSeenTour('dashboard')).toBe(true)
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
})
