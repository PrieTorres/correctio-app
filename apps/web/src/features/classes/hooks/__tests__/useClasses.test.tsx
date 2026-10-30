import { beforeEach, describe, expect, it } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { classSchema } from '@/lib/schemas'
import { clearAllCollections, createCollection } from '@/lib/storage/collection'
import { renderHookWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import type { Class } from '@/types/domain'
import {
  CLASS_PAGE_SIZE,
  classKeys,
  useAddStudent,
  useArchiveClass,
  useClass,
  useClassList,
  useImportStudents,
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

  /** Each page is its own request to the API, so it needs its own place in the cache. */
  it('separates listings by page, starting from the first', () => {
    expect(classKeys.list(false, '', 2)).not.toEqual(classKeys.list(false, ''))
    expect(classKeys.list(false, '', 1)).toEqual(classKeys.list(false, ''))
  })

  it('scopes detail and students under the same root as the list', () => {
    expect(classKeys.detail('1')[0]).toBe(classKeys.all[0])
    expect(classKeys.students('1')[0]).toBe(classKeys.all[0])
  })

  /** Invalidating `lists` has to reach every page of every filter, and nothing else. */
  it('groups every listing, and only the listings, under `lists`', () => {
    expect(classKeys.list(true, 'a', 3).slice(0, classKeys.lists.length)).toEqual([...classKeys.lists])
    expect(classKeys.students('1').slice(0, classKeys.lists.length)).not.toEqual([...classKeys.lists])
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

  /** A teacher with more classes than a page reaches the rest by paging, never by losing them. */
  it('reads the page it is asked for and reports the total of every page', async () => {
    const numbered = (index: number) => String(index).padStart(3, '0')
    const many: Class[] = Array.from({ length: CLASS_PAGE_SIZE + 1 }, (_, index) => ({
      id: `class-${numbered(index)}`,
      teacherId: TEST_TEACHER_ID,
      name: `Turma ${numbered(index)}`,
      subject: 'Matemática',
      term: '2026/2',
      status: 'active',
      inviteCode: `CODE${index}`,
    }))
    createCollection('classes', classSchema).writeAll(many)

    const { result } = renderHookWithProviders(() => ({
      first: useClassList(false, ''),
      second: useClassList(false, '', 2),
    }))

    await waitFor(() => expect(result.current.second.isSuccess).toBe(true))
    expect(result.current.first.data?.items).toHaveLength(CLASS_PAGE_SIZE)
    expect(result.current.second.data?.items.map((item) => item.name)).toEqual([`Turma ${numbered(CLASS_PAGE_SIZE)}`])
    expect(result.current.second.data?.total).toBe(CLASS_PAGE_SIZE + 1)
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

  it('imports a pasted list and refreshes the class listing', async () => {
    const { result } = renderHookWithProviders(() => ({
      importStudents: useImportStudents('class-1'),
      list: useStudents('class-1'),
    }))

    await waitFor(() => expect(result.current.list.isSuccess).toBe(true))
    const outcome = await act(() =>
      result.current.importStudents.mutateAsync([
        { fullName: 'Ana Beatriz', registration: '2026001' },
        { fullName: 'Bruno Lima', registration: '2026002' },
      ]),
    )

    expect(outcome).toEqual({ created: 2, skipped: 0 })
    await waitFor(() => expect(result.current.list.data).toHaveLength(2))
  })

  /** The screen tells the teacher how many were skipped, so the hook has to hand the count over. */
  it('reports a registration already in the class as skipped', async () => {
    const { result } = renderHookWithProviders(() => ({
      add: useAddStudent('class-1'),
      importStudents: useImportStudents('class-1'),
    }))

    await act(() => result.current.add.mutateAsync(student))
    const outcome = await act(() =>
      result.current.importStudents.mutateAsync([student, { fullName: 'Bruno Lima', registration: '2026002' }]),
    )

    expect(outcome).toEqual({ created: 1, skipped: 1 })
  })

  it('imports into the class it was given and leaves the others alone', async () => {
    const { result } = renderHookWithProviders(() => ({
      importStudents: useImportStudents('class-1'),
      other: useStudents('class-2'),
    }))

    await act(() => result.current.importStudents.mutateAsync([student]))

    await waitFor(() => expect(result.current.other.isSuccess).toBe(true))
    expect(result.current.other.data).toEqual([])
  })

  /** #146: the cards of P3 count the students, so adding or removing one refreshes them at once. */
  it('keeps the count of the class list in step with its students', async () => {
    const { result } = renderHookWithProviders(() => ({
      save: useSaveClass(),
      list: useClassList(false, ''),
    }))
    const created = await act(() => result.current.save.mutateAsync({ input }))
    await waitFor(() => expect(result.current.list.data?.items[0]?.studentCount).toBe(0))

    const students = renderHookWithProviders(() => ({
      add: useAddStudent(created.id),
      act: useStudentAction(created.id),
      list: useClassList(false, ''),
    }))
    const added = await act(() => students.result.current.add.mutateAsync(student))
    await waitFor(() => expect(students.result.current.list.data?.items[0]?.studentCount).toBe(1))

    await act(() => students.result.current.act.mutateAsync({ id: added.id, action: 'anonymize' }))
    await waitFor(() => expect(students.result.current.list.isFetching).toBe(false))
    expect(students.result.current.list.data?.items[0]?.studentCount).toBe(1)

    await act(() => students.result.current.act.mutateAsync({ id: added.id, action: 'remove' }))
    await waitFor(() => expect(students.result.current.list.data?.items[0]?.studentCount).toBe(0))
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
