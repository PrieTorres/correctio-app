import type { RecentActivity } from '@/types/domain'
import { recentActivitySchema } from '@/lib/schemas'
import { createCollection, simulateLatency } from '@/lib/storage/collection'

/**
 * Read-only: nothing writes to this collection yet, only the seed does. It
 * does not fit `OwnedRepository` because there is no create, update or
 * archive to expose — just the teacher's most recent entries.
 */
export interface ActivityRepository {
  listRecent: (limit?: number) => Promise<RecentActivity[]>
}

export function createLocalActivityRepository(teacherId: string): ActivityRepository {
  const collection = createCollection('activity', recentActivitySchema)

  return {
    async listRecent(limit = 5) {
      await simulateLatency()
      return collection
        .readAll()
        .filter((entry) => entry.teacherId === teacherId)
        .toSorted((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        .slice(0, limit)
    },
  }
}
