import { beforeEach, describe, expect, it } from 'vitest'
import { clearAllCollections, createCollection } from '@/lib/storage/collection'
import { questionSchema } from '@/lib/schemas'
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
    expect((await repository.list({ archived: true })).items).toHaveLength(1)
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

describe('question repository, order', () => {
  beforeEach(clearAllCollections)

  const newQuestion = (statement: string) => ({
    type: 'objetiva' as const,
    statement,
    tags: [],
    alternatives: [
      { id: `${statement}-a`, text: 'uma' },
      { id: `${statement}-b`, text: 'outra' },
    ],
    correctAlternativeId: `${statement}-a`,
    allowShuffleAlternatives: true,
  })

  /**
   * Sorting by statement buried a question just written among hundreds, and
   * finding it again meant remembering how it was worded.
   */
  it('puts the newest question first', async () => {
    const repository = createLocalQuestionRepository('ana')
    await repository.create(newQuestion('Antiga'))
    await repository.create(newQuestion('Zebra, que viria por último em ordem alfabética'))

    const [first] = (await repository.list()).items
    expect(first?.statement).toContain('Zebra')
  })

  it('records when a question entered the bank', async () => {
    const repository = createLocalQuestionRepository('ana')

    const created = await repository.create(newQuestion('Qualquer'))

    expect(created.createdAt).toBeDefined()
  })

  it('sorts a question from before this was recorded to the end', async () => {
    const repository = createLocalQuestionRepository('ana')
    const created = await repository.create(newQuestion('Nova'))
    const collection = createCollection('questions', questionSchema)
    collection.writeAll([
      ...collection.readAll(),
      { ...created, id: 'legacy', statement: 'Sem data', createdAt: undefined },
    ])

    const items = (await repository.list()).items
    expect(items[items.length - 1]?.id).toBe('legacy')
  })
})

describe('question repository, server-side filters', () => {
  beforeEach(clearAllCollections)

  const question = (statement: string, type: 'objetiva' | 'discursiva') =>
    type === 'objetiva'
      ? {
          type,
          statement,
          tags: [] as string[],
          alternatives: [
            { id: `${statement}-a`, text: 'uma' },
            { id: `${statement}-b`, text: 'outra' },
          ],
          correctAlternativeId: `${statement}-a`,
          allowShuffleAlternatives: true,
        }
      : {
          type,
          statement,
          tags: [] as string[],
          maxScore: 2,
          allowShuffleAlternatives: false,
        }

  /**
   * The bug this test was written against: with pagination running on the
   * server, filtering the page in the browser hid records that lived past the
   * first page. A discursive question is invisible in a listing whose first
   * page happens to be all objective ones if the filter runs after the slice.
   *
   * With the filter running before pagination, the discursive question is the
   * only one in the listing and the total is 1 regardless of how many pages of
   * objective questions exist.
   */
  it('finds a discursive question that lives past the first page of objectives', async () => {
    const repository = createLocalQuestionRepository('ana')
    await repository.create(question('Objetiva 1', 'objetiva'))
    await repository.create(question('Objetiva 2', 'objetiva'))
    await repository.create(question('Objetiva 3', 'objetiva'))
    await repository.create(question('Discursiva 1', 'discursiva'))

    const page = await repository.list({ type: 'discursiva', pageSize: 2 })

    expect(page.total).toBe(1)
    expect(page.items).toHaveLength(1)
    expect(page.items[0]?.statement).toBe('Discursiva 1')
  })

  it('filters by tag, keeping only questions that carry every chosen tag', async () => {
    const repository = createLocalQuestionRepository('ana')
    await repository.create({
      ...question('Tem matemática', 'objetiva'),
      tags: ['matemática'],
    })
    await repository.create({
      ...question('Tem matemática e álgebra', 'objetiva'),
      tags: ['matemática', 'álgebra'],
    })

    const both = await repository.list({ tags: ['matemática', 'álgebra'] })
    expect(both.total).toBe(1)
    expect(both.items[0]?.statement).toBe('Tem matemática e álgebra')

    const one = await repository.list({ tags: ['matemática'] })
    expect(one.total).toBe(2)
  })

  it('filters by onlyUntagged', async () => {
    const repository = createLocalQuestionRepository('ana')
    await repository.create({ ...question('Com tag', 'objetiva'), tags: ['qualquer'] })
    await repository.create(question('Sem tag', 'objetiva'))

    const untagged = await repository.list({ onlyUntagged: true })
    expect(untagged.total).toBe(1)
    expect(untagged.items[0]?.statement).toBe('Sem tag')
  })

  it('sorts by statement when asked, before paginating', async () => {
    const repository = createLocalQuestionRepository('ana')
    await repository.create(question('Zebra', 'objetiva'))
    await repository.create(question('Abacaxi', 'objetiva'))
    await repository.create(question('Manga', 'objetiva'))

    const page = await repository.list({ sort: 'statement', pageSize: 2 })
    expect(page.items.map((q) => q.statement)).toEqual(['Abacaxi', 'Manga'])
    expect(page.total).toBe(3)
  })

  it('pages without dropping records when a filter narrows the listing', async () => {
    const repository = createLocalQuestionRepository('ana')
    for (let i = 1; i <= 5; i += 1) {
      await repository.create(question(`Objetiva ${i}`, 'objetiva'))
    }
    await repository.create(question('Discursiva', 'discursiva'))

    const page1 = await repository.list({ type: 'objetiva', page: 1, pageSize: 2 })
    expect(page1.items).toHaveLength(2)
    expect(page1.total).toBe(5)

    const page3 = await repository.list({ type: 'objetiva', page: 3, pageSize: 2 })
    expect(page3.items).toHaveLength(1)
    expect(page3.total).toBe(5)
  })

  it('reports every tag in use by the teacher, without repetition', async () => {
    const repository = createLocalQuestionRepository('ana')
    await repository.create({
      ...question('A', 'objetiva'),
      tags: ['álgebra', 'matemática'],
    })
    await repository.create({ ...question('B', 'objetiva'), tags: ['matemática'] })

    const tags = await repository.tags()
    expect(tags).toEqual(['álgebra', 'matemática'])
  })

  it('leaves out another teacher when collecting tags', async () => {
    const ana = createLocalQuestionRepository('ana')
    const bruno = createLocalQuestionRepository('bruno')
    await bruno.create({
      ...question('Do Bruno', 'objetiva'),
      tags: ['particular-do-bruno'],
    })

    const tags = await ana.tags()
    expect(tags).toEqual([])
  })
})