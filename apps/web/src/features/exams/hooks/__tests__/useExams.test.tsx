import { beforeEach, describe, expect, it } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { clearAllCollections } from '@/lib/storage/collection'
import { renderHookWithProviders } from '@/test-utils'
import { examKeys, useArchiveExam, useDuplicateExam, useExamList, useSaveExam } from '../useExams'

const input = {
  title: 'Prova 1',
  description: 'Conteúdo até a aula 8',
  questions: [{ questionId: 'q1', order: 0, score: 2, allowShuffleAlternatives: true }],
  defaultShuffleQuestions: true,
  defaultShuffleAlternatives: false,
}

describe('examKeys', () => {
  it('separates the active listing from the archived one', () => {
    expect(examKeys.list(true, '')).not.toEqual(examKeys.list(false, ''))
  })

  it('separates one search from another', () => {
    expect(examKeys.list(false, 'cálculo')).not.toEqual(examKeys.list(false, 'física'))
  })
})

describe('exam data hooks', () => {
  beforeEach(clearAllCollections)

  it('lists an exam once it is saved', async () => {
    const { result } = renderHookWithProviders(() => ({
      save: useSaveExam(),
      list: useExamList(false, ''),
    }))
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true))

    await act(() => result.current.save.mutateAsync({ input }))

    await waitFor(() => expect(result.current.list.data?.items).toHaveLength(1))
  })

  it('moves an exam between the active and archived listings', async () => {
    const { result } = renderHookWithProviders(() => ({
      save: useSaveExam(),
      archive: useArchiveExam(),
      active: useExamList(false, ''),
      archived: useExamList(true, ''),
    }))
    const created = await act(() => result.current.save.mutateAsync({ input }))
    await waitFor(() => expect(result.current.active.data?.items).toHaveLength(1))

    await act(() => result.current.archive.mutateAsync({ id: created.id, archive: true }))

    await waitFor(() => expect(result.current.active.data?.items).toHaveLength(0))
    await waitFor(() => expect(result.current.archived.data?.items).toHaveLength(1))
  })

  it('brings an archived exam back to the active listing', async () => {
    const { result } = renderHookWithProviders(() => ({
      save: useSaveExam(),
      archive: useArchiveExam(),
      active: useExamList(false, ''),
    }))
    const created = await act(() => result.current.save.mutateAsync({ input }))
    await act(() => result.current.archive.mutateAsync({ id: created.id, archive: true }))

    await act(() => result.current.archive.mutateAsync({ id: created.id, archive: false }))

    await waitFor(() => expect(result.current.active.data?.items).toHaveLength(1))
  })

  it('duplicates with the questions and the shuffle preferences intact', async () => {
    const { result } = renderHookWithProviders(() => ({
      save: useSaveExam(),
      duplicate: useDuplicateExam(),
      list: useExamList(false, ''),
    }))
    const created = await act(() => result.current.save.mutateAsync({ input }))

    const copy = await act(() => result.current.duplicate.mutateAsync(created.id))

    expect(copy.title).toBe('Prova 1 (cópia)')
    expect(copy.questions).toEqual(created.questions)
    expect(copy.defaultShuffleAlternatives).toBe(false)
    await waitFor(() => expect(result.current.list.data?.items).toHaveLength(2))
  })

  it('gives the copy its own identity and leaves the original untouched', async () => {
    const { result } = renderHookWithProviders(() => ({
      save: useSaveExam(),
      duplicate: useDuplicateExam(),
    }))
    const created = await act(() => result.current.save.mutateAsync({ input }))

    const copy = await act(() => result.current.duplicate.mutateAsync(created.id))

    expect(copy.id).not.toBe(created.id)
    expect(copy.status).toBe('draft')
  })

  it('fails clearly when duplicating something that is not there', async () => {
    const { result } = renderHookWithProviders(() => useDuplicateExam())

    await expect(result.current.mutateAsync('nope')).rejects.toThrow(/não encontrada/i)
  })
})
