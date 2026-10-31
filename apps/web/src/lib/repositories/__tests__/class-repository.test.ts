import { beforeEach, describe, expect, it, vi } from 'vitest'
import { countStudentsByClass, createHttpClassRepository, createLocalClassRepository } from '../class-repository'
import { createLocalStudentRepository } from '../student-repository'
import type { ApiClient } from '../http/api-client'
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
    expect((await repository.list({ archived: true })).items).toHaveLength(1)

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

/** #146: the cards of P3 count the students as P5 does. */
describe('class repository, student count', () => {
  beforeEach(clearAllCollections)

  it('counts anonymized students and leaves removed ones out', () => {
    const counts = countStudentsByClass([
      { classId: 'c1' },
      { classId: 'c1', removedAt: '2026-10-30T00:00:00.000Z' },
      { classId: 'c1' },
      { classId: 'c2' },
    ])

    expect(counts.get('c1')).toBe(2)
    expect(counts.get('c2')).toBe(1)
    expect(counts.get('c3')).toBeUndefined()
  })

  it('lists every class with its count, an empty one with zero', async () => {
    const classes = createLocalClassRepository('ana')
    const students = createLocalStudentRepository()
    const calculo = await classes.create({ name: 'Cálculo I', subject: 'Matemática', term: '2026/2' })
    await classes.create({ name: 'Física II', subject: 'Física', term: '2026/2' })

    const first = await students.add(calculo.id, { fullName: 'Ana Lima', registration: '202601' })
    const second = await students.add(calculo.id, { fullName: 'Bruno Melo', registration: '202602' })
    await students.add(calculo.id, { fullName: 'Carla Dias', registration: '202603' })
    await students.anonymize(calculo.id, first.id)
    await students.remove(calculo.id, second.id)

    const page = await classes.list()

    expect(page.items.map((item) => [item.name, item.studentCount])).toEqual([
      ['Cálculo I', 2],
      ['Física II', 0],
    ])
  })

  it('never writes the count into the stored class', async () => {
    const classes = createLocalClassRepository('ana')
    await classes.create({ name: 'Cálculo I', subject: 'Matemática', term: '2026/2' })

    await classes.list()

    expect(createCollection('classes', classSchema).readAll()[0]).not.toHaveProperty('studentCount')
  })
})

describe('class repository, duplicates', () => {
  beforeEach(clearAllCollections)

  const turma = { name: 'Cálculo I', subject: 'Matemática', term: '2026/2' }

  it('refuses a second class with the same name in the same term', async () => {
    const repository = createLocalClassRepository('ana')
    await repository.create(turma)

    await expect(repository.create(turma)).rejects.toThrow(/já existe uma turma/i)
  })

  /** "Cálculo I" and "calculo i" are the same class to the person typing them. */
  it('refuses it however the accents and the case were typed', async () => {
    const repository = createLocalClassRepository('ana')
    await repository.create(turma)

    await expect(repository.create({ ...turma, name: 'calculo i' })).rejects.toThrow(
      /já existe uma turma/i,
    )
  })

  it('allows the same name in another term, which is the next semester', async () => {
    const repository = createLocalClassRepository('ana')
    await repository.create(turma)

    await expect(repository.create({ ...turma, term: '2027/1' })).resolves.toBeDefined()
  })

  it('points at the restore when the clash is with an archived class', async () => {
    const repository = createLocalClassRepository('ana')
    const created = await repository.create(turma)
    await repository.archive(created.id)

    await expect(repository.create(turma)).rejects.toThrow(/arquivada/i)
  })

  it('leaves another teacher free to use the same name', async () => {
    await createLocalClassRepository('ana').create(turma)

    await expect(createLocalClassRepository('bruno').create(turma)).resolves.toBeDefined()
  })

  it('lets a class keep its own name while being edited', async () => {
    const repository = createLocalClassRepository('ana')
    const created = await repository.create(turma)

    await expect(
      repository.update(created.id, { subject: 'Cálculo aplicado' }),
    ).resolves.toBeDefined()
  })

  it('refuses renaming a class onto another one', async () => {
    const repository = createLocalClassRepository('ana')
    await repository.create(turma)
    const other = await repository.create({ ...turma, name: 'Álgebra Linear' })

    await expect(repository.update(other.id, { name: 'Cálculo I' })).rejects.toThrow(
      /já existe uma turma/i,
    )
  })
})

/** The routes of #41: the generic adapter, pointed at `/classes`, with the class schema checking every answer. */
describe('HTTP class repository', () => {
  const CLASS = {
    id: 'c1',
    teacherId: 'ana',
    name: 'Cálculo I',
    subject: 'Matemática',
    term: '2026/2',
    status: 'active',
    inviteCode: 'ABC12345',
  }

  it('lists the classes of the API, searched and paged on the server', async () => {
    const request = vi.fn<ApiClient['request']>(() => Promise.resolve({ items: [CLASS], total: 1 }))
    const repository = createHttpClassRepository({ request })

    await expect(repository.list({ search: 'calculo', page: 2, pageSize: 50 })).resolves.toEqual({ items: [CLASS], total: 1 })
    expect(request).toHaveBeenCalledWith('GET', '/classes', {
      query: { search: 'calculo', archived: undefined, page: 2, pageSize: 50 },
    })
  })

  /** #146: the count of each card comes from the API, checked like the rest of the class. */
  it('keeps the student count the API sends with each class', async () => {
    const request = vi.fn<ApiClient['request']>(() => Promise.resolve({ items: [{ ...CLASS, studentCount: 12 }], total: 1 }))
    const repository = createHttpClassRepository({ request })

    await expect(repository.list()).resolves.toMatchObject({ items: [{ studentCount: 12 }] })
  })

  it('archives and restores through the routes of the class', async () => {
    const request = vi.fn<ApiClient['request']>(() => Promise.resolve(undefined))
    const repository = createHttpClassRepository({ request })

    await repository.archive('c1')
    await repository.restore('c1')

    expect(request).toHaveBeenNthCalledWith(1, 'PATCH', '/classes/c1/archive')
    expect(request).toHaveBeenNthCalledWith(2, 'PATCH', '/classes/c1/restore')
  })
})
