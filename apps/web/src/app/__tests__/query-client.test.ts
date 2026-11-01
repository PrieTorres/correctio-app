import { MutationObserver } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { dashboardKeys } from '@/features/dashboard/hooks/useDashboard'
import { reportKeys } from '@/features/reports/hooks/report-keys'
import { READS_ONLY } from '@/lib/background-jobs'
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

  /** A correction saved on P16 changes the numbers of P18 and P19, which the grading hooks do not know about. */
  it('marks every report stale after any successful write', async () => {
    const queryClient = createAppQueryClient()
    queryClient.setQueryData(reportKeys.consolidated, [])
    queryClient.setQueryData(reportKeys.application('a1'), { summary: { count: 0 } })

    await new MutationObserver(queryClient, { mutationFn: () => Promise.resolve('saved') }).mutate()

    expect(queryClient.getQueryState(reportKeys.consolidated)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(reportKeys.application('a1'))?.isInvalidated).toBe(true)
  })

  /** Exporting reads the report it exports: refetching it on success would only repeat what is on screen. */
  it('leaves the panel and the reports as they are after a job that only reads', async () => {
    const queryClient = createAppQueryClient()
    queryClient.setQueryData(dashboardKeys.summary, { counts: 1 })
    queryClient.setQueryData(reportKeys.consolidated, [])

    await new MutationObserver(queryClient, { mutationFn: () => Promise.resolve('exported'), meta: READS_ONLY }).mutate()

    expect(queryClient.getQueryState(dashboardKeys.summary)?.isInvalidated).toBe(false)
    expect(queryClient.getQueryState(reportKeys.consolidated)?.isInvalidated).toBe(false)
  })
})
