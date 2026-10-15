import { MutationObserver } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { dashboardKeys } from '@/features/dashboard/hooks/useDashboard'
import { StorageError } from '@/lib/storage/errors'
import { createAppQueryClient, shouldRetry } from '../query-client'

describe('shouldRetry', () => {
  it('tries a failure once more', () => {
    expect(shouldRetry(0, new StorageError('Falhou.', 'failure'))).toBe(true)
    expect(shouldRetry(0, new TypeError('Failed to fetch'))).toBe(true)
  })

  it('does not repeat an answer: invalid, not found, conflict or unauthorized', () => {
    for (const code of ['invalid', 'not-found', 'conflict', 'unauthorized'] as const) {
      expect(shouldRetry(0, new StorageError('Não.', code))).toBe(false)
    }
  })

  it('stops after one more try', () => {
    expect(shouldRetry(1, new StorageError('Falhou.', 'failure'))).toBe(false)
  })
})

describe('createAppQueryClient', () => {
  it('marks the dashboard stale after any successful write', async () => {
    const queryClient = createAppQueryClient()
    queryClient.setQueryData(dashboardKeys.summary, { counts: 1 })

    await new MutationObserver(queryClient, { mutationFn: () => Promise.resolve('saved') }).mutate()

    expect(queryClient.getQueryState(dashboardKeys.summary)?.isInvalidated).toBe(true)
  })
})
