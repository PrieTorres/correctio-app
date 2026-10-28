import { beforeEach, describe, expect, it } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { createTeacherRepositories } from '@/lib/repositories'
import { clearAllCollections } from '@/lib/storage/collection'
import { renderHookWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import { seedApplicationChain } from '@/test-fixtures'
import { useGenerateApplication } from '@/features/applications/hooks/useApplications'
import { useReadSheets } from '@/features/grading/hooks/useGrading'
import { useConsolidatedReport } from '../useConsolidatedReport'

const GENERATE = {
  versions: [{ shuffleQuestions: false, shuffleAlternatives: false }],
  withStudentIdentification: true,
}

describe('useConsolidatedReport', () => {
  beforeEach(clearAllCollections)

  it('lists nothing before anything is corrected', async () => {
    await seedApplicationChain()
    const { result } = renderHookWithProviders(() => useConsolidatedReport())

    await waitFor(() => expect(result.current.data).toEqual([]), { timeout: 8000 })
  })

  /** An application with no corrections is not a row with zeros; it is not a row. */
  it('leaves out an application that was generated but never corrected', async () => {
    const seeded = await seedApplicationChain()
    const { result: generate } = renderHookWithProviders(() => useGenerateApplication())
    await act(() => generate.current.mutateAsync({ id: seeded.applicationId, request: GENERATE }))

    const { result } = renderHookWithProviders(() => useConsolidatedReport())

    await waitFor(() => expect(result.current.data).toEqual([]), { timeout: 8000 })
  })

  it('includes an application once a sheet has been corrected', async () => {
    const seeded = await seedApplicationChain()
    const { result: generate } = renderHookWithProviders(() => useGenerateApplication())
    await act(() => generate.current.mutateAsync({ id: seeded.applicationId, request: GENERATE }))

    const sheets = await createTeacherRepositories(TEST_TEACHER_ID).printing.listSheets(
      seeded.applicationId,
    )
    const { result: read } = renderHookWithProviders(() => useReadSheets())
    await act(() =>
      read.current.mutateAsync({
        applicationId: seeded.applicationId,
        sheetIds: [sheets[0]?.id ?? ''],
      }),
    )

    const { result } = renderHookWithProviders(() => useConsolidatedReport())

    await waitFor(() => expect(result.current.data).toHaveLength(1), { timeout: 8000 })
    expect(result.current.data?.[0]?.examTitle).toBe('Prova de teste')
    expect(result.current.data?.[0]?.scores).toHaveLength(1)
  })

  /** What the filters of the consolidated report (P19) match against. */
  it('carries the class, subject and term of each row', async () => {
    const seeded = await seedApplicationChain()
    const { result: generate } = renderHookWithProviders(() => useGenerateApplication())
    await act(() => generate.current.mutateAsync({ id: seeded.applicationId, request: GENERATE }))
    const sheets = await createTeacherRepositories(TEST_TEACHER_ID).printing.listSheets(
      seeded.applicationId,
    )
    const { result: read } = renderHookWithProviders(() => useReadSheets())
    await act(() =>
      read.current.mutateAsync({ applicationId: seeded.applicationId, sheetIds: [sheets[0]?.id ?? ''] }),
    )

    const { result } = renderHookWithProviders(() => useConsolidatedReport())

    await waitFor(() => expect(result.current.data).toHaveLength(1), { timeout: 8000 })
    expect(result.current.data?.[0]).toMatchObject({
      classId: seeded.classId,
      className: 'Turma',
      subject: 'Matemática',
      term: '2026/2',
    })
  })
})
