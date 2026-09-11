import { beforeEach, describe, expect, it } from 'vitest'
import { clearAllCollections } from '@/lib/storage/collection'
import { createLocalApplicationRepository } from '../application-repository'

const input = { examId: 'exam-1', classId: 'class-1', date: '2026-10-05T13:00:00.000Z' }

describe('application repository', () => {
  beforeEach(clearAllCollections)

  it('creates an application as a draft, with grades unreleased', async () => {
    const repository = createLocalApplicationRepository('ana')

    const created = await repository.create(input)

    expect(created.status).toBe('draft')
    expect(created.gradesReleased).toBe(false)
  })

  it('archives to closed and drops it from the default listing', async () => {
    const repository = createLocalApplicationRepository('ana')
    const created = await repository.create(input)

    await repository.archive(created.id)

    expect((await repository.list()).items).toHaveLength(0)
    expect((await repository.list({ includeArchived: true })).items).toHaveLength(1)
  })

  it('restores to draft rather than to generated, since paper is not restored', async () => {
    const repository = createLocalApplicationRepository('ana')
    const created = await repository.create(input)
    await repository.update(created.id, {})
    await repository.archive(created.id)

    await repository.restore(created.id)

    expect((await repository.getById(created.id))?.status).toBe('draft')
  })

  it('keeps the date and the links through an update', async () => {
    const repository = createLocalApplicationRepository('ana')
    const created = await repository.create(input)

    await repository.update(created.id, { date: '2026-10-06T13:00:00.000Z' })
    const updated = await repository.getById(created.id)

    expect(updated?.date).toBe('2026-10-06T13:00:00.000Z')
    expect(updated?.examId).toBe('exam-1')
    expect(updated?.classId).toBe('class-1')
  })

  it('hides one teacher application from another', async () => {
    const ana = createLocalApplicationRepository('ana')
    const bruno = createLocalApplicationRepository('bruno')
    const created = await ana.create(input)

    await expect(bruno.getById(created.id)).resolves.toBeNull()
  })

  it('orders by date, since an application is an event', async () => {
    const repository = createLocalApplicationRepository('ana')
    await repository.create({ ...input, date: '2026-12-01T13:00:00.000Z' })
    await repository.create({ ...input, date: '2026-03-01T13:00:00.000Z' })

    const dates = (await repository.list()).items.map((item) => item.date)
    expect(dates).toEqual(['2026-03-01T13:00:00.000Z', '2026-12-01T13:00:00.000Z'])
  })
})
