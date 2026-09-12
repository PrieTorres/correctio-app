import { beforeEach, describe, expect, it } from 'vitest'
import { clearAllCollections } from '@/lib/storage/collection'
import { createLocalExamRepository } from '../exam-repository'

const input = {
  title: 'Prova 1 — Cálculo',
  description: 'Primeira avaliação do semestre',
  questions: [{ questionId: 'q1', order: 0, score: 2, allowShuffleAlternatives: true }],
  defaultShuffleQuestions: true,
  defaultShuffleAlternatives: true,
}

describe('exam repository', () => {
  beforeEach(clearAllCollections)

  it('creates an exam as a draft, since applying is a later step', async () => {
    const repository = createLocalExamRepository('ana')

    expect((await repository.create(input)).status).toBe('draft')
  })

  it('archives to closed and drops it from the default listing', async () => {
    const repository = createLocalExamRepository('ana')
    const created = await repository.create(input)

    await repository.archive(created.id)

    expect((await repository.getById(created.id))?.status).toBe('closed')
    expect((await repository.list()).items).toHaveLength(0)
    expect((await repository.list({ archived: true })).items).toHaveLength(1)
  })

  it('restores to draft rather than to ready', async () => {
    const repository = createLocalExamRepository('ana')
    const created = await repository.create(input)
    await repository.archive(created.id)

    await repository.restore(created.id)

    expect((await repository.getById(created.id))?.status).toBe('draft')
  })

  it('searches the title and the description', async () => {
    const repository = createLocalExamRepository('ana')
    await repository.create(input)

    expect((await repository.list({ search: 'cálculo' })).items).toHaveLength(1)
    expect((await repository.list({ search: 'avaliação' })).items).toHaveLength(1)
    expect((await repository.list({ search: 'física' })).items).toHaveLength(0)
  })

  it('keeps the questions and the shuffle preferences through an update', async () => {
    const repository = createLocalExamRepository('ana')
    const created = await repository.create({ ...input, defaultShuffleAlternatives: false })

    await repository.update(created.id, { title: 'Outro título' })
    const updated = await repository.getById(created.id)

    expect(updated?.title).toBe('Outro título')
    expect(updated?.questions).toEqual(created.questions)
    expect(updated?.defaultShuffleAlternatives).toBe(false)
  })

  it('hides one teacher exam from another', async () => {
    const ana = createLocalExamRepository('ana')
    const bruno = createLocalExamRepository('bruno')
    const created = await ana.create(input)

    await expect(bruno.getById(created.id)).resolves.toBeNull()
    expect((await bruno.list()).items).toHaveLength(0)
  })
})
