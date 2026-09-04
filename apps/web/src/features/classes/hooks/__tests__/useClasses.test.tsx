import { beforeEach, describe, expect, it } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { clearAllCollections } from '@/lib/storage/collection'
import { renderHookWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import {
  classKeys,
  useAddStudent,
  useArchiveClass,
  useClass,
  useClassList,
  useSaveClass,
  useStudentAction,
  useStudents,
} from '../useClasses'

const input = { name: 'Cálculo I', subject: 'Matemática', term: '2026/2' }

describe('classKeys', () => {
  it('separates the active and archived listings', () => {
    expect(classKeys.list(true, '')).not.toEqual(classKeys.list(false, ''))
  })

  it('separates listings by search term', () => {
    expect(classKeys.list(false, 'a')).not.toEqual(classKeys.list(false, 'b'))
  })

  it('scopes detail and students under the same root as the list', () => {
    expect(classKeys.detail('1')[0]).toBe(classKeys.all[0])
    expect(classKeys.students('1')[0]).toBe(classKeys.all[0])
  })
})

describe('class data hooks', () => {
  beforeEach(clearAllCollections)

  it('loads an empty list before anything is created', async () => {
    const { result } = renderHookWithProviders(() => useClassList(false, ''))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.items).toEqual([])
  })

  it('shows a created class in the listing', async () => {
    const { result } = renderHookWithProviders(() => ({
      save: useSaveClass(),
      list: useClassList(false, ''),
    }))

    await waitFor(() => expect(result.current.list.isSuccess).toBe(true))
    await act(() => result.current.save.mutateAsync({ input }))

    await waitFor(() => expect(result.current.list.data?.items).toHaveLength(1))
    expect(result.current.list.data?.items[0]?.name).toBe('Cálculo I')
  })

  it('moves a class between the active and archived listings', async () => {
    const { result } = renderHookWithProviders(() => ({
      save: useSaveClass(),
      archive: useArchiveClass(),
      active: useClassList(false, ''),
      archived: useClassList(true, ''),
    }))

    const created = await act(() => result.current.save.mutateAsync({ input }))
    await waitFor(() => expect(result.current.active.data?.items).toHaveLength(1))

    await act(() => result.current.archive.mutateAsync({ id: created.id, archive: true }))

    await waitFor(() => expect(result.current.active.data?.items).toHaveLength(0))
    await waitFor(() => expect(result.current.archived.data?.items).toHaveLength(1))
  })

  it('updates an existing class instead of creating another', async () => {
    const { result } = renderHookWithProviders(() => ({
      save: useSaveClass(),
      list: useClassList(false, ''),
    }))

    const created = await act(() => result.current.save.mutateAsync({ input }))
    await result.current.save.mutateAsync({
      id: created.id,
      input: { ...input, name: 'Cálculo I — Noturno' },
    })

    await waitFor(() =>
      expect(result.current.list.data?.items[0]?.name).toBe('Cálculo I — Noturno'),
    )
    expect(result.current.list.data?.items).toHaveLength(1)
  })

  it('does not fetch a detail while the id is unknown', () => {
    const { result } = renderHookWithProviders(() => useClass(undefined))

    expect(result.current.fetchStatus).toBe('idle')
  })

  it('loads the detail of an existing class', async () => {
    const { result } = renderHookWithProviders(() => useSaveClass())
    const created = await result.current.mutateAsync({ input })

    const detail = renderHookWithProviders(() => useClass(created.id))
    await waitFor(() => expect(detail.result.current.isSuccess).toBe(true))

    expect(detail.result.current.data?.teacherId).toBe(TEST_TEACHER_ID)
  })
})

describe('student data hooks', () => {
  beforeEach(clearAllCollections)

  const student = { fullName: 'Ana Beatriz', registration: '2026001', email: undefined }

  it('does not fetch while the class id is unknown', () => {
    const { result } = renderHookWithProviders(() => useStudents(undefined))

    expect(result.current.fetchStatus).toBe('idle')
  })

  it('shows an added student in the class listing', async () => {
    const { result } = renderHookWithProviders(() => ({
      add: useAddStudent('class-1'),
      list: useStudents('class-1'),
    }))

    await waitFor(() => expect(result.current.list.isSuccess).toBe(true))
    await act(() => result.current.add.mutateAsync(student))

    await waitFor(() => expect(result.current.list.data).toHaveLength(1))
    expect(result.current.list.data?.[0]?.fullName).toBe('Ana Beatriz')
  })

  it('removes a student from the listing', async () => {
    const { result } = renderHookWithProviders(() => ({
      add: useAddStudent('class-1'),
      act: useStudentAction('class-1'),
      list: useStudents('class-1'),
    }))

    const added = await act(() => result.current.add.mutateAsync(student))
    await waitFor(() => expect(result.current.list.data).toHaveLength(1))

    await act(() => result.current.act.mutateAsync({ id: added.id, action: 'remove' }))

    await waitFor(() => expect(result.current.list.data).toHaveLength(0))
  })

  it('anonymizes a student without removing the record', async () => {
    const { result } = renderHookWithProviders(() => ({
      add: useAddStudent('class-1'),
      act: useStudentAction('class-1'),
      list: useStudents('class-1'),
    }))

    const added = await act(() => result.current.add.mutateAsync(student))
    await waitFor(() => expect(result.current.list.data).toHaveLength(1))

    await act(() => result.current.act.mutateAsync({ id: added.id, action: 'anonymize' }))

    await waitFor(() => expect(result.current.list.data?.[0]?.anonymizedAt).toBeDefined())
    expect(result.current.list.data).toHaveLength(1)
    expect(result.current.list.data?.[0]?.fullName).not.toBe('Ana Beatriz')
  })
})
