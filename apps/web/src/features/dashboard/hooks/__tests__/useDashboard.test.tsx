import { beforeEach, describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'
import { clearAllCollections } from '@/lib/storage/collection'
import { createTeacherRepositories } from '@/lib/repositories'
import { renderHookWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import { seedApplicationChain } from '@/test-fixtures'
import { useDashboardSummary } from '../useDashboard'

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
    const printing = { versions: [{ shuffleQuestions: false, shuffleAlternatives: false }], withStudentIdentification: true }
    await applications.generate(earlier.id, printing)
    await applications.generate(later.id, printing)

    const { result } = renderHookWithProviders(() => useDashboardSummary())

    await waitFor(() => expect(result.current.data?.gradable).toHaveLength(2), { timeout: 8000 })
    expect(result.current.data?.gradable.map((item) => item.id)).toEqual([later.id, earlier.id])
    expect(result.current.data?.gradable[0]).toMatchObject({ title: 'Prova de teste', detail: 'Turma' })
  })
})
