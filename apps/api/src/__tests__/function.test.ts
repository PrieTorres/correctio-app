import { describe, expect, it } from 'vitest'
import { api } from '../function'

const ONE_GIB_IN_MB = 1024

describe('api function', () => {
  /** The default 256 MiB ran out on the first phone photo sent in production. */
  it('has the memory to read a phone photo', () => {
    expect(api.__endpoint.availableMemoryMb).toBe(ONE_GIB_IN_MB)
  })

  /** The rate limits count in memory, so a second instance would double every limit. */
  it('runs on one instance', () => {
    expect(api.__endpoint.maxInstances).toBe(1)
  })
})
