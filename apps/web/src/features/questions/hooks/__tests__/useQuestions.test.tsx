import { useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { clearAllCollections, createCollection } from '@/lib/storage/collection'
import { renderHookWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import { questionSchema, type QuestionInput } from '@/lib/schemas'
import type { Question } from '@/types/domain'
import {
  QUESTION_PAGE_SIZE,
  questionKeys,
  useDeleteQuestion,
  useDuplicateQuestion,
  useQuestionCount,
  useQuestionList,
  useQuestionsByIds,
  useRememberQuestions,
  useQuestionTags,
  useSaveQuestion,
  type QuestionFilters,
} from '../useQuestions'

const ALL: QuestionFilters = { search: '', type: 'all', tags: [], deleted: false }

const objective: QuestionInput = {
  type: 'objetiva',
  statement: 'Derivada de x²?',
  tags: ['Derivadas', 'Cálculo I'],
  alternatives: [
    { id: 'a', text: '2x' },
    { id: 'b', text: 'x' },
  ],
  correctAlternativeId: 'a',
  allowShuffleAlternatives: true,
}

const essay: QuestionInput = {
  type: 'discursiva',
  statement: 'Explique continuidade.',
  tags: ['Limites'],
  maxScore: 2,
  allowShuffleAlternatives: true,
}

describe('questionKeys', () => {
  it('separates listings that use different filters', () => {
    expect(questionKeys.list(ALL)).not.toEqual(questionKeys.list({ ...ALL, type: 'objetiva' }))
    expect(questionKeys.list(ALL)).not.toEqual(questionKeys.list({ ...ALL, tags: ['x'] }))
  })
})

describe('question data hooks', () => {
  beforeEach(clearAllCollections)

  it('lists a saved question', async () => {
    const { result } = renderHookWithProviders(() => ({
      save: useSaveQuestion(),
      list: useQuestionList(ALL),
    }))
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true))

    await act(() => result.current.save.mutateAsync({ input: objective }))

    await waitFor(() => expect(result.current.list.data?.items).toHaveLength(1))
  })

  it('filters by type', async () => {
    const { result } = renderHookWithProviders(() => ({
      save: useSaveQuestion(),
      objective: useQuestionList({ ...ALL, type: 'objetiva' }),
      essay: useQuestionList({ ...ALL, type: 'discursiva' }),
    }))
    await act(() => result.current.save.mutateAsync({ input: objective }))
    await act(() => result.current.save.mutateAsync({ input: essay }))

    await waitFor(() => expect(result.current.objective.data?.items).toHaveLength(1))
    await waitFor(() => expect(result.current.essay.data?.items).toHaveLength(1))
    expect(result.current.objective.data?.items[0]?.type).toBe('objetiva')
  })

  it('requires every selected tag, not just one of them', async () => {
    const { result } = renderHookWithProviders(() => ({
      save: useSaveQuestion(),
      both: useQuestionList({ ...ALL, tags: ['Derivadas', 'Cálculo I'] }),
      missing: useQuestionList({ ...ALL, tags: ['Derivadas', 'Limites'] }),
    }))
    await act(() => result.current.save.mutateAsync({ input: objective }))

    await waitFor(() => expect(result.current.both.data?.items).toHaveLength(1))
    await waitFor(() => expect(result.current.missing.data?.items).toHaveLength(0))
  })

  it('lists the newest first, and by statement only when asked', async () => {
    const { result } = renderHookWithProviders(() => ({
      save: useSaveQuestion(),
      newest: useQuestionList(ALL),
      byStatement: useQuestionList({ ...ALL, sort: 'statement' }),
    }))
    await act(() => result.current.save.mutateAsync({ input: objective }))
    await act(() => result.current.save.mutateAsync({ input: essay }))

    await waitFor(() => expect(result.current.newest.data?.items).toHaveLength(2))
    await waitFor(() => expect(result.current.byStatement.data?.items).toHaveLength(2))
    expect(result.current.newest.data?.items.map((item) => item.statement)).toEqual([
      essay.statement,
      objective.statement,
    ])
    expect(result.current.byStatement.data?.items.map((item) => item.statement)).toEqual([
      objective.statement,
      essay.statement,
    ])
  })

  it('moves a question between the active and deleted listings', async () => {
    const { result } = renderHookWithProviders(() => ({
      save: useSaveQuestion(),
      remove: useDeleteQuestion(),
      active: useQuestionList(ALL),
      deleted: useQuestionList({ ...ALL, deleted: true }),
    }))
    const created = await act(() => result.current.save.mutateAsync({ input: objective }))
    await waitFor(() => expect(result.current.active.data?.items).toHaveLength(1))

    await act(() => result.current.remove.mutateAsync({ id: created.id, deleted: true }))

    await waitFor(() => expect(result.current.active.data?.items).toHaveLength(0))
    await waitFor(() => expect(result.current.deleted.data?.items).toHaveLength(1))
  })

  it('collects the tags in use, without repeating them', async () => {
    const { result } = renderHookWithProviders(() => ({
      save: useSaveQuestion(),
      tags: useQuestionTags(),
    }))
    await act(() => result.current.save.mutateAsync({ input: objective }))
    await act(() => result.current.save.mutateAsync({ input: { ...essay, tags: ['Derivadas'] } }))

    await waitFor(() => expect(result.current.tags.data).toEqual(['Cálculo I', 'Derivadas']))
  })
})

describe('useDuplicateQuestion', () => {
  beforeEach(clearAllCollections)

  const original = {
    type: 'objetiva' as const,
    statement: 'Questão original',
    tags: ['Limites'],
    alternatives: [
      { id: 'a', text: 'certa' },
      { id: 'b', text: 'errada' },
    ],
    correctAlternativeId: 'a',
    allowShuffleAlternatives: false,
  }

  it('copies the content and marks the copy in its statement', async () => {
    const { result } = renderHookWithProviders(() => ({
      save: useSaveQuestion(),
      duplicate: useDuplicateQuestion(),
    }))
    const created = await act(() => result.current.save.mutateAsync({ input: original }))

    const copy = await act(() => result.current.duplicate.mutateAsync(created.id))

    expect(copy.statement).toBe('Questão original (cópia)')
    expect(copy.tags).toEqual(['Limites'])
    expect(copy.allowShuffleAlternatives).toBe(false)
  })

  it('gives the copy its own identity, leaving the original alone', async () => {
    const { result } = renderHookWithProviders(() => ({
      save: useSaveQuestion(),
      duplicate: useDuplicateQuestion(),
      list: useQuestionList({ search: '', type: 'all', tags: [], deleted: false }),
    }))
    const created = await act(() => result.current.save.mutateAsync({ input: original }))

    const copy = await act(() => result.current.duplicate.mutateAsync(created.id))

    expect(copy.id).not.toBe(created.id)
    await waitFor(() => expect(result.current.list.data?.items).toHaveLength(2))
  })

  it('fails clearly when duplicating something that is not there', async () => {
    const { result } = renderHookWithProviders(() => useDuplicateQuestion())

    await expect(result.current.mutateAsync('nope')).rejects.toThrow(/não encontrada/i)
  })
})

describe('useQuestionsByIds', () => {
  beforeEach(clearAllCollections)

  const numbered = (index: number) => String(index).padStart(3, '0')
  const essayNumbered = (index: number): Question => ({
    id: `question-${numbered(index)}`,
    teacherId: TEST_TEACHER_ID,
    type: 'discursiva',
    statement: `Questão ${numbered(index)}`,
    tags: [],
    maxScore: 1,
    allowShuffleAlternatives: true,
  })

  /** An exam looks its questions up by id, so one past the first page of the bank, or deleted from it, is still found. */
  it('finds every question asked, past the first page of the bank and deleted ones included', async () => {
    const many = Array.from({ length: QUESTION_PAGE_SIZE + 1 }, (_, index) => essayNumbered(index))
    const deleted: Question = { ...essayNumbered(999), statement: 'Questão excluída', deletedAt: '2026-10-21T12:00:00.000Z' }
    createCollection('questions', questionSchema).writeAll([...many, deleted])
    const ids = [`question-${numbered(QUESTION_PAGE_SIZE)}`, deleted.id]

    const { result } = renderHookWithProviders(() => useQuestionsByIds(ids))
    await waitFor(() => expect(result.current.isPending).toBe(false))

    expect(result.current.byId.get(ids[0] ?? '')?.statement).toBe(`Questão ${numbered(QUESTION_PAGE_SIZE)}`)
    expect(result.current.byId.get(deleted.id)?.statement).toBe('Questão excluída')
  })

  it('reports a question that does not exist by leaving it out', async () => {
    const { result } = renderHookWithProviders(() => useQuestionsByIds(['nowhere']))
    await waitFor(() => expect(result.current.isPending).toBe(false))

    expect(result.current.byId.size).toBe(0)
  })

  /**
   * A question picked or drawn on screen shows at once, the way the form adds
   * it: remembered first, then added to the exam. It is not even in this
   * browser's storage here, so only the cache can answer.
   */
  it('answers from what the screen remembered, before any request', () => {
    const remembered = essayNumbered(7)
    const { result } = renderHookWithProviders(() => {
      const [ids, setIds] = useState<string[]>([])
      return { remember: useRememberQuestions(), setIds, lookup: useQuestionsByIds(ids) }
    })

    act(() => {
      result.current.remember([remembered])
      result.current.setIds([remembered.id])
    })

    expect(result.current.lookup.isPending).toBe(false)
    expect(result.current.lookup.byId.get(remembered.id)).toEqual(remembered)
  })
})

describe('useQuestionCount', () => {
  beforeEach(clearAllCollections)

  it('counts the active questions carrying every tag asked', async () => {
    const { result } = renderHookWithProviders(() => ({
      save: useSaveQuestion(),
      all: useQuestionCount([]),
      derivatives: useQuestionCount(['Derivadas']),
      both: useQuestionCount(['Derivadas', 'Limites']),
    }))
    await act(() => result.current.save.mutateAsync({ input: objective }))
    await act(() => result.current.save.mutateAsync({ input: essay }))

    await waitFor(() => expect(result.current.all.data).toBe(2))
    await waitFor(() => expect(result.current.derivatives.data).toBe(1))
    await waitFor(() => expect(result.current.both.data).toBe(0))
  })
})
