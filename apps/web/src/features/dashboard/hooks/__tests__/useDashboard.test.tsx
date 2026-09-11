import { beforeEach, describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'
import { clearAllCollections, createCollection } from '@/lib/storage/collection'
import { recentActivitySchema } from '@/lib/schemas'
import { renderHookWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import { dashboardKeys, useRecentActivity } from '../useDashboard'

describe('dashboardKeys', () => {
  it('has a stable recent activity key', () => {
    expect(dashboardKeys.recentActivity).toEqual(['dashboard', 'recentActivity'])
  })
})

describe('useRecentActivity', () => {
  beforeEach(clearAllCollections)

  it('loads an empty list before anything is seeded', async () => {
    const { result } = renderHookWithProviders(() => useRecentActivity())

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('shows entries scoped to the current teacher, most recent first', async () => {
    createCollection('activity', recentActivitySchema).writeAll([
      {
        id: 'older',
        teacherId: TEST_TEACHER_ID,
        description: 'Turma criada',
        occurredAt: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 'newer',
        teacherId: TEST_TEACHER_ID,
        description: 'Questão criada',
        occurredAt: '2026-09-10T00:00:00.000Z',
      },
      {
        id: 'other-teacher',
        teacherId: 'someone-else',
        description: 'Não deveria aparecer',
        occurredAt: '2026-09-11T00:00:00.000Z',
      },
    ])

    const { result } = renderHookWithProviders(() => useRecentActivity())

    await waitFor(() => expect(result.current.data).toHaveLength(2))
    expect(result.current.data?.[0]?.id).toBe('newer')
  })
})
