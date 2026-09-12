import { beforeEach, describe, expect, it } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { clearAllCollections } from '@/lib/storage/collection'
import { renderHookWithProviders } from '@/test-utils'
import type { QuestionInput } from '@/lib/schemas'
import {
  questionKeys,
  useDeleteQuestion,
  useDuplicateQuestion,
  useQuestionList,
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
