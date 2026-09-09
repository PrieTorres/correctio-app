import { beforeEach, describe, expect, it } from 'vitest'
import { clearAllCollections } from '@/lib/storage/collection'
import { createLocalQuestionRepository } from '../question-repository'
import { archiveByStatus, archiveByTimestamp } from '../create-owned-repository'

const objective = {
  type: 'objetiva' as const,
  statement: 'Qual é a derivada de x²?',
  tags: ['Derivadas'],
  alternatives: [
    { id: 'a', text: '2x' },
    { id: 'b', text: 'x' },
  ],
  correctAlternativeId: 'a',
  allowShuffleAlternatives: true,
}

describe('question repository', () => {
  beforeEach(clearAllCollections)

  it('hides a deleted question from the default listing', async () => {
    const repository = createLocalQuestionRepository('ana')
    const created = await repository.create(objective)

    await repository.archive(created.id)

    expect((await repository.list()).items).toHaveLength(0)
    expect((await repository.list({ includeArchived: true })).items).toHaveLength(1)
  })

  it('marks the deletion with a timestamp instead of removing the record', async () => {
    const repository = createLocalQuestionRepository('ana')
    const created = await repository.create(objective)

    await repository.archive(created.id)

    const deleted = await repository.getById(created.id)
    expect(deleted).not.toBeNull()
    expect(deleted?.deletedAt).toBeDefined()
  })

  it('clears the timestamp on restore', async () => {
    const repository = createLocalQuestionRepository('ana')
    const created = await repository.create(objective)
    await repository.archive(created.id)

    await repository.restore(created.id)

    expect((await repository.getById(created.id))?.deletedAt).toBeUndefined()
    expect((await repository.list()).items).toHaveLength(1)
  })

  it('searches the statement and the tags', async () => {
    const repository = createLocalQuestionRepository('ana')
    await repository.create(objective)

    expect((await repository.list({ search: 'derivada' })).items).toHaveLength(1)
    expect((await repository.list({ search: 'Derivadas' })).items).toHaveLength(1)
    expect((await repository.list({ search: 'integral' })).items).toHaveLength(0)
  })

  it('keeps one teacher out of another bank', async () => {
    const ana = createLocalQuestionRepository('ana')
    const bruno = createLocalQuestionRepository('bruno')
    const created = await ana.create(objective)

    await expect(bruno.getById(created.id)).resolves.toBeNull()
  })
})

describe('archiving strategies', () => {
  it('reads and writes a status enum', () => {
    const strategy = archiveByStatus<{ status: string }>('active', 'archived')
    const live = { status: 'active' }

    expect(strategy.isArchived(live)).toBe(false)
    expect(strategy.isArchived(strategy.setArchived(live, true))).toBe(true)
    expect(strategy.setArchived(live, true).status).toBe('archived')
  })

  it('reads and writes a nullable timestamp', () => {
    const strategy = archiveByTimestamp<{ deletedAt?: string }, 'deletedAt'>('deletedAt')
    const live = {}

    expect(strategy.isArchived(live)).toBe(false)
    const archived = strategy.setArchived(live, true)
    expect(strategy.isArchived(archived)).toBe(true)
    expect(strategy.isArchived(strategy.setArchived(archived, false))).toBe(false)
  })

  it('leaves the rest of the entity untouched', () => {
    const strategy = archiveByTimestamp<{ id: string; deletedAt?: string }, 'deletedAt'>('deletedAt')

    expect(strategy.setArchived({ id: 'q1' }, true).id).toBe('q1')
  })
})
