import { beforeEach, describe, expect, it } from 'vitest'
import { clearAllCollections } from '@/lib/storage/collection'
import { createLocalExamRepository } from '../exam-repository'
import { createLocalQuestionRepository } from '../question-repository'

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

describe('exam repository, duplicates', () => {
  beforeEach(clearAllCollections)

  it('refuses a second exam with the same title', async () => {
    const repository = createLocalExamRepository('ana')
    await repository.create(input)

    await expect(repository.create(input)).rejects.toThrow(/já existe uma prova/i)
  })

  it('refuses it however the accents and the case were typed', async () => {
    const repository = createLocalExamRepository('ana')
    await repository.create(input)

    await expect(repository.create({ ...input, title: 'prova 1 - calculo' })).resolves.toBeDefined()
    await expect(repository.create({ ...input, title: 'PROVA 1 — CÁLCULO' })).rejects.toThrow(
      /já existe uma prova/i,
    )
  })

  /** Duplicating appends "(cópia)", so the feature still works. */
  it('lets a copy in, because its title differs', async () => {
    const repository = createLocalExamRepository('ana')
    await repository.create(input)

    await expect(
      repository.create({ ...input, title: `${input.title} (cópia)` }),
    ).resolves.toBeDefined()
  })

  it('points at the restore when the clash is with an archived exam', async () => {
    const repository = createLocalExamRepository('ana')
    const created = await repository.create(input)
    await repository.archive(created.id)

    await expect(repository.create(input)).rejects.toThrow(/arquivada/i)
  })
})

describe('exam repository, the automatic draw', () => {
  beforeEach(clearAllCollections)

  const essay = { type: 'discursiva' as const, tags: ['Limites'], maxScore: 1, allowShuffleAlternatives: true }

  /** The demo draws over this browser's bank, with the same rules the server applies. */
  it('draws only active questions of this teacher, with a tag asked, leaving out excludeIds', async () => {
    const mine = createLocalQuestionRepository('ana')
    const kept = await mine.create({ ...essay, statement: 'Já está na prova' })
    const deleted = await mine.create({ ...essay, statement: 'Excluída' })
    await mine.archive(deleted.id)
    const untagged = await mine.create({ ...essay, tags: [], statement: 'Sem a tag' })
    const drawable = await mine.create({ ...essay, statement: 'Pode sair' })
    await createLocalQuestionRepository('bia').create({ ...essay, statement: 'De outra pessoa' })

    const result = await createLocalExamRepository('ana').draw({
      tags: ['Limites'],
      multipleChoiceCount: 0,
      openEndedCount: 5,
      excludeIds: [kept.id],
    })

    expect(result.questions.map((item) => item.id)).toEqual([drawable.id])
    expect(result.questions.map((item) => item.id)).not.toContain(untagged.id)
    expect(result.shortfall).toEqual({ multipleChoice: 0, openEnded: 4 })
  })
})
