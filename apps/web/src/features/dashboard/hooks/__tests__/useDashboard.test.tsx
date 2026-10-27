import { beforeEach, describe, expect, it } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { clearAllCollections } from '@/lib/storage/collection'
import { createTeacherRepositories } from '@/lib/repositories'
import { renderHookWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import { seedApplicationChain } from '@/test-fixtures'
import { useGenerateApplication } from '@/features/applications/hooks/useApplications'
import { useReadSheets } from '@/features/grading/hooks/useGrading'
import { useDashboardSummary } from '../useDashboard'

const OTHER_TEACHER_ID = 'another-teacher'

/** Prints the sheets of an application and reads the first `count` of them, the way the upload screen does. */
async function generateAndRead(
  applicationId: string,
  { count, identified, teacherId = TEST_TEACHER_ID }: { count: number; identified: boolean; teacherId?: string },
) {
  const services = { repositories: createTeacherRepositories(teacherId) }
  const { result: generate } = renderHookWithProviders(() => useGenerateApplication(), services)
  await act(() =>
    generate.current.mutateAsync({
      id: applicationId,
      options: {
        versionCount: 1,
        shuffleQuestions: false,
        shuffleAlternatives: false,
        withStudentIdentification: identified,
      },
    }),
  )

  const sheets = await services.repositories.printing.listSheets(applicationId)
  const { result: read } = renderHookWithProviders(() => useReadSheets(), services)
  await act(() =>
    read.current.mutateAsync({ applicationId, sheetIds: sheets.slice(0, count).map((sheet) => sheet.id) }),
  )
}

describe('useDashboardSummary', () => {
  beforeEach(clearAllCollections)

  it('counts nothing in a system with nothing in it', async () => {
    const { result } = renderHookWithProviders(() => useDashboardSummary())

    await waitFor(() => expect(result.current.data).not.toBeUndefined())

    expect(result.current.data).toMatchObject({
      classes: 0,
      questions: 0,
      exams: 0,
      applications: 0,
      recent: [],
    })
  })

  it('counts what the teacher has created', async () => {
    await seedApplicationChain()
    const { result } = renderHookWithProviders(() => useDashboardSummary())

    await waitFor(() => expect(result.current.data?.classes).toBe(1), { timeout: 8000 })

    expect(result.current.data?.questions).toBe(2)
    expect(result.current.data?.exams).toBe(1)
    expect(result.current.data?.applications).toBe(1)
  })

  it('names the exam and the class of a recent application', async () => {
    await seedApplicationChain()
    const { result } = renderHookWithProviders(() => useDashboardSummary())

    await waitFor(() => expect(result.current.data?.recent).toHaveLength(1), { timeout: 8000 })

    expect(result.current.data?.recent[0]?.title).toBe('Prova de teste')
    expect(result.current.data?.recent[0]?.detail).toBe('Turma')
  })

  /** What "Corrigir folhas" offers: the seeded draft has no sheets, so only the two generated ones count. */
  it('lists the applications to grade, generated only and the most recent first', async () => {
    const { examId, classId } = await seedApplicationChain()
    const { applications } = createTeacherRepositories(TEST_TEACHER_ID)
    const earlier = await applications.create({ examId, classId, date: '2026-10-01T12:00:00.000Z' })
    const later = await applications.create({ examId, classId, date: '2026-10-12T12:00:00.000Z' })
    await applications.markGenerated(earlier.id)
    await applications.markGenerated(later.id)

    const { result } = renderHookWithProviders(() => useDashboardSummary())

    await waitFor(() => expect(result.current.data?.gradable).toHaveLength(2), { timeout: 8000 })
    expect(result.current.data?.gradable.map((item) => item.id)).toEqual([later.id, earlier.id])
    expect(result.current.data?.gradable[0]).toMatchObject({ title: 'Prova de teste', detail: 'Turma' })
  })

  describe('pending corrections', () => {
    it('counts nothing before any sheet is read', async () => {
      await seedApplicationChain()
      const { result } = renderHookWithProviders(() => useDashboardSummary())

      await waitFor(() => expect(result.current.data?.applications).toBe(1), { timeout: 8000 })
      expect(result.current.data?.pendingCorrections).toBe(0)
    })

    /** The seeded exam has an open-ended question, so every sheet read lands in progress (RF48). */
    it('counts the corrections still waiting for an open-ended score', async () => {
      const { applicationId } = await seedApplicationChain()
      await generateAndRead(applicationId, { count: 2, identified: true })

      const { result } = renderHookWithProviders(() => useDashboardSummary())

      await waitFor(() => expect(result.current.data?.pendingCorrections).toBe(2), { timeout: 8000 })
    })

    /** Sheets of an exam without identification carry no student until the teacher assigns one (RF31). */
    it('counts the sheets read with no student, once each, together with the ones in progress', async () => {
      const { applicationId, examId, classId } = await seedApplicationChain()
      await generateAndRead(applicationId, { count: 2, identified: false })
      const identified = await createTeacherRepositories(TEST_TEACHER_ID).applications.create({
        examId,
        classId,
        date: '2026-10-12T12:00:00.000Z',
      })
      await generateAndRead(identified.id, { count: 1, identified: true })

      const { result } = renderHookWithProviders(() => useDashboardSummary())

      await waitFor(() => expect(result.current.data?.pendingCorrections).toBe(3), { timeout: 8000 })
    })

    it('does not count the corrections of another teacher', async () => {
      const other = await seedApplicationChain(OTHER_TEACHER_ID)
      await generateAndRead(other.applicationId, { count: 2, identified: true, teacherId: OTHER_TEACHER_ID })
      await seedApplicationChain()

      const { result } = renderHookWithProviders(() => useDashboardSummary())

      await waitFor(() => expect(result.current.data?.applications).toBe(1), { timeout: 8000 })
      expect(result.current.data?.pendingCorrections).toBe(0)
    })
  })
})
