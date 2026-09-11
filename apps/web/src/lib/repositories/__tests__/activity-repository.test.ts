import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalActivityRepository } from '../activity-repository'
import { clearAllCollections, createCollection } from '@/lib/storage/collection'
import { recentActivitySchema } from '@/lib/schemas'

const seedEntry = (id: string, teacherId: string, occurredAt: string) => ({
  id,
  teacherId,
  description: `Entrada ${id}`,
  occurredAt,
})

describe('activity repository', () => {
  beforeEach(clearAllCollections)

  it('lists nothing when the collection is empty', async () => {
    const repository = createLocalActivityRepository('ana')

    await expect(repository.listRecent()).resolves.toEqual([])
  })

  it('lists only entries owned by the current teacher', async () => {
    const collection = createCollection('activity', recentActivitySchema)
    collection.writeAll([
      seedEntry('a1', 'ana', '2026-09-10T00:00:00.000Z'),
      seedEntry('b1', 'bruno', '2026-09-10T00:00:00.000Z'),
    ])

    const ana = await createLocalActivityRepository('ana').listRecent()

    expect(ana).toHaveLength(1)
    expect(ana[0]?.id).toBe('a1')
  })

  it('orders the most recent entry first', async () => {
    const collection = createCollection('activity', recentActivitySchema)
    collection.writeAll([
      seedEntry('older', 'ana', '2026-09-01T00:00:00.000Z'),
      seedEntry('newer', 'ana', '2026-09-10T00:00:00.000Z'),
    ])

    const items = await createLocalActivityRepository('ana').listRecent()

    expect(items.map((item) => item.id)).toEqual(['newer', 'older'])
  })

  it('caps the result at the given limit, defaulting to 5', async () => {
    const collection = createCollection('activity', recentActivitySchema)
    collection.writeAll(
      Array.from({ length: 8 }, (_, index) =>
        seedEntry(`entry-${index}`, 'ana', `2026-09-0${(index % 9) + 1}T00:00:00.000Z`),
      ),
    )

    const repository = createLocalActivityRepository('ana')

    expect(await repository.listRecent()).toHaveLength(5)
    expect(await repository.listRecent(2)).toHaveLength(2)
  })
})
