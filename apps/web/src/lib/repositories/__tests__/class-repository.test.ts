import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalClassRepository } from '../class-repository'
import { clearAllCollections, createCollection } from '@/lib/storage/collection'
import { classSchema } from '@/lib/schemas'

describe('class repository', () => {
  beforeEach(clearAllCollections)

  const input = { name: 'Cálculo I', subject: 'Matemática', term: '2026/2' }

  it('assigns a unique invite code on creation, as the specification requires', async () => {
    const repository = createLocalClassRepository('ana')
    const first = await repository.create(input)
    const second = await repository.create({ ...input, name: 'Outra' })

    expect(first.inviteCode).toHaveLength(8)
    expect(first.inviteCode).not.toBe(second.inviteCode)
  })

  it('lists only classes owned by the current teacher', async () => {
    const ana = createLocalClassRepository('ana')
    const bruno = createLocalClassRepository('bruno')

    await ana.create(input)
    await bruno.create({ name: 'Física II', subject: 'Física', term: '2026/2' })

    const page = await ana.list()
    expect(page.items).toHaveLength(1)
    expect(page.items[0]?.name).toBe('Cálculo I')
  })

  it('does not expose another teacher records even when the id is known', async () => {
    const ana = createLocalClassRepository('ana')
    const bruno = createLocalClassRepository('bruno')

    const created = await ana.create(input)

    await expect(bruno.getById(created.id)).resolves.toBeNull()
  })

  it('hides archived records from the default listing and brings them back on restore', async () => {
    const repository = createLocalClassRepository('ana')
    const created = await repository.create(input)

    await repository.archive(created.id)
    expect((await repository.list()).items).toHaveLength(0)
    expect((await repository.list({ includeArchived: true })).items).toHaveLength(1)

    await repository.restore(created.id)
    expect((await repository.list()).items).toHaveLength(1)
  })

  it('keeps the record when archiving instead of deleting it', async () => {
    const repository = createLocalClassRepository('ana')
    const created = await repository.create(input)

    await repository.archive(created.id)

    const archived = await repository.getById(created.id)
    expect(archived).not.toBeNull()
    expect(archived?.status).toBe('archived')
  })

  it('searches by name and subject, ignoring case and accents in the term', async () => {
    const repository = createLocalClassRepository('ana')
    await repository.create(input)
    await repository.create({ name: 'Física II', subject: 'Física', term: '2026/2' })

    expect((await repository.list({ search: 'cálculo' })).items).toHaveLength(1)
    expect((await repository.list({ search: 'FÍSICA' })).items).toHaveLength(1)
  })

  it('does not drop unknown fields when updating a record', async () => {
    const repository = createLocalClassRepository('ana')
    const created = await repository.create(input)

    const collection = createCollection('classes', classSchema)
    const stored = collection.readAll()
    collection.writeAll(
      stored.map((item) =>
        item.id === created.id ? { ...item, futureApiField: 'keep me' } : item,
      ),
    )

    await repository.update(created.id, { name: 'Cálculo I — Noturno' })

    expect(collection.readAll()[0]).toMatchObject({ futureApiField: 'keep me' })
  })

  it('does not drop unknown fields when archiving a record', async () => {
    const repository = createLocalClassRepository('ana')
    const created = await repository.create(input)

    const collection = createCollection('classes', classSchema)
    collection.writeAll(
      collection.readAll().map((item) => ({ ...item, futureApiField: 'keep me' })),
    )

    await repository.archive(created.id)

    expect(collection.readAll()[0]).toMatchObject({
      status: 'archived',
      futureApiField: 'keep me',
    })
  })

  it('rejects updates to a missing record', async () => {
    const repository = createLocalClassRepository('ana')
    await expect(repository.update('nope', { name: 'x' })).rejects.toThrow(/não encontrada/i)
  })
})
