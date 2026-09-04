import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { clearAllCollections, createCollection, simulateLatency } from '../collection'
import { StorageError } from '../errors'

const schema = z.object({ id: z.string(), name: z.string() })

describe('collection', () => {
  beforeEach(() => {
    clearAllCollections()
    vi.restoreAllMocks()
  })

  it('returns an empty array when nothing was ever written', () => {
    expect(createCollection('things', schema).readAll()).toEqual([])
  })

  it('round-trips what it wrote', () => {
    const collection = createCollection('things', schema)
    collection.writeAll([{ id: '1', name: 'one' }])

    expect(collection.readAll()).toEqual([{ id: '1', name: 'one' }])
  })

  it('drops records that no longer match the schema instead of throwing', () => {
    window.localStorage.setItem(
      'correctio:v1:things',
      JSON.stringify([{ id: '1', name: 'valid' }, { id: 2 }, null]),
    )

    expect(createCollection('things', schema).readAll()).toEqual([{ id: '1', name: 'valid' }])
  })

  it('preserves fields the schema does not declare', () => {
    window.localStorage.setItem(
      'correctio:v1:things',
      JSON.stringify([
        { id: '1', name: 'one', clientCorrectionId: 'abc', syncStatus: 'synced' },
      ]),
    )

    const [read] = createCollection('things', schema).readAll()

    expect(read).toMatchObject({ clientCorrectionId: 'abc', syncStatus: 'synced' })
  })

  it('survives a read-write round trip without losing unknown fields', () => {
    const collection = createCollection('things', schema)
    window.localStorage.setItem(
      'correctio:v1:things',
      JSON.stringify([{ id: '1', name: 'one', legacyColumn: 42 }]),
    )

    collection.writeAll(collection.readAll())

    expect(collection.readAll()[0]).toMatchObject({ legacyColumn: 42 })
  })

  it('lets the validated value win over the raw one for known keys', () => {
    window.localStorage.setItem(
      'correctio:v1:things',
      JSON.stringify([{ id: '1', name: 'one', extra: 'kept' }]),
    )

    const [read] = createCollection('things', schema).readAll()

    expect(read).toEqual({ id: '1', name: 'one', extra: 'kept' })
  })

  it('reports corrupted JSON as a storage failure', () => {
    window.localStorage.setItem('correctio:v1:things', 'not json')

    expect(() => createCollection('things', schema).readAll()).toThrow(StorageError)
  })

  it('ignores a stored value that is not an array', () => {
    window.localStorage.setItem('correctio:v1:things', JSON.stringify({ nope: true }))

    expect(createCollection('things', schema).readAll()).toEqual([])
  })

  it('surfaces a full quota with its own code so the UI can explain it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    try {
      createCollection('things', schema).writeAll([{ id: '1', name: 'one' }])
      expect.unreachable('writeAll should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(StorageError)
      expect((error as StorageError).code).toBe('quota-exceeded')
    }
  })

  it('reports other write failures as a generic failure', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('boom')
    })

    try {
      createCollection('things', schema).writeAll([])
      expect.unreachable('writeAll should have thrown')
    } catch (error) {
      expect((error as StorageError).code).toBe('failure')
    }
  })

  it('reports unreadable storage as a storage failure', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(() => createCollection('things', schema).readAll()).toThrow(StorageError)
  })

  it('clears only its own keys', () => {
    createCollection('things', schema).writeAll([{ id: '1', name: 'one' }])
    window.localStorage.setItem('unrelated', 'keep me')

    clearAllCollections()

    expect(window.localStorage.getItem('correctio:v1:things')).toBeNull()
    expect(window.localStorage.getItem('unrelated')).toBe('keep me')
  })

  it('resolves after the simulated latency', async () => {
    await expect(simulateLatency(0)).resolves.toBeUndefined()
  })
})
