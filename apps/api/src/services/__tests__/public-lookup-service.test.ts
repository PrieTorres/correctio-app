import { describe, expect, it, vi } from 'vitest'
import type { PublicLookupRepository } from '../../repositories/public-lookup-repository'
import { createPublicLookupService } from '../public-lookup-service'

const EMPTY = { sheet: null, version: null, application: null, exam: null, group: null, student: null, correction: null, bank: [] }

describe('public lookup service', () => {
  it('answers an unknown code as invalid', async () => {
    const repository: PublicLookupRepository = { findSources: vi.fn(() => Promise.resolve(EMPTY)) }

    await expect(createPublicLookupService(repository).lookup('NOPE')).resolves.toEqual({ status: 'INVALID_CODE' })
    expect(repository.findSources).toHaveBeenCalledWith('NOPE')
  })

  it('does not reach the database for a code no sheet could carry', async () => {
    const repository: PublicLookupRepository = { findSources: vi.fn(() => Promise.resolve(EMPTY)) }
    const service = createPublicLookupService(repository)

    await expect(service.lookup('')).resolves.toEqual({ status: 'INVALID_CODE' })
    await expect(service.lookup('A'.repeat(33))).resolves.toEqual({ status: 'INVALID_CODE' })
    expect(repository.findSources).not.toHaveBeenCalled()
  })
})
