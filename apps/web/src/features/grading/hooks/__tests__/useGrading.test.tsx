import { beforeEach, describe, expect, it } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { CORRECTION_SOURCE, CORRECTION_STATUS } from '@/types/domain'
import { createTeacherRepositories } from '@/lib/repositories'
import { clearAllCollections } from '@/lib/storage/collection'
import { renderHookWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import { seedApplicationChain } from '@/test-fixtures'
import { useGenerateApplication } from '@/features/applications/hooks/useApplications'
import {
  gradingKeys,
  useAssignStudent,
  useConfirmCorrection,
  useGradingOverview,
  useReadSheets,
} from '../useGrading'

const repositories = () => createTeacherRepositories(TEST_TEACHER_ID)

const GENERATE = {
  versionCount: 1,
  shuffleQuestions: false,
  shuffleAlternatives: false,
  withStudentIdentification: true,
}

async function seedGenerated() {
  const seeded = await seedApplicationChain()
  const { result } = renderHookWithProviders(() => useGenerateApplication())
  await act(() => result.current.mutateAsync({ id: seeded.applicationId, options: GENERATE }))
  return seeded
}

describe('gradingKeys', () => {
  it('keeps one application apart from another', () => {
    expect(gradingKeys.ofApplication('a')).not.toEqual(gradingKeys.ofApplication('b'))
  })
})

describe('grading hooks', () => {
  beforeEach(clearAllCollections)

  it('gathers everything the grading screens need in one read', async () => {
    const seeded = await seedGenerated()
    const { result } = renderHookWithProviders(() => useGradingOverview(seeded.applicationId))

    await waitFor(() => expect(result.current.data).not.toBeUndefined(), { timeout: 8000 })

    expect(result.current.data?.sheets).toHaveLength(2)
    expect(result.current.data?.exam?.id).toBe(seeded.examId)
    expect(result.current.data?.students).toHaveLength(2)
  })

  it('reports nothing for an application that is not there', async () => {
    const { result } = renderHookWithProviders(() => useGradingOverview('nope'))

    await waitFor(() => expect(result.current.data).toBeNull(), { timeout: 8000 })
  })

  it('reads the chosen sheets and stores a correction for each', async () => {
    const seeded = await seedGenerated()
    const sheets = await repositories().printing.listSheets(seeded.applicationId)
    const { result } = renderHookWithProviders(() => useReadSheets())

    const saved = await act(() =>
      result.current.mutateAsync({
        applicationId: seeded.applicationId,
        sheetIds: sheets.map((sheet) => sheet.id),
      }),
    )

    expect(saved).toHaveLength(2)
  })

  /**
   * The exam mixes both kinds, so the machine grades what it can and the
   * correction waits for the teacher rather than claiming to be finished.
   */
  it('leaves a mixed exam in progress until the open-ended question is scored', async () => {
    const seeded = await seedGenerated()
    const sheets = await repositories().printing.listSheets(seeded.applicationId)
    const { result } = renderHookWithProviders(() => useReadSheets())

    const [correction] = await act(() =>
      result.current.mutateAsync({
        applicationId: seeded.applicationId,
        sheetIds: [sheets[0]?.id ?? ''],
      }),
    )

    expect(correction?.status).toBe(CORRECTION_STATUS.IN_PROGRESS)
    expect(correction?.source).toBe(CORRECTION_SOURCE.IMAGE_UPLOAD)
  })

  it('reads only the sheets asked for', async () => {
    const seeded = await seedGenerated()
    const sheets = await repositories().printing.listSheets(seeded.applicationId)
    const { result } = renderHookWithProviders(() => useReadSheets())

    const saved = await act(() =>
      result.current.mutateAsync({
        applicationId: seeded.applicationId,
        sheetIds: [sheets[0]?.id ?? ''],
      }),
    )

    expect(saved).toHaveLength(1)
  })

  it('fails clearly when the application is not there', async () => {
    const { result } = renderHookWithProviders(() => useReadSheets())

    await expect(
      result.current.mutateAsync({ applicationId: 'nope', sheetIds: [] }),
    ).rejects.toThrow(/não encontrada/i)
  })

  it('finishes the correction once every open-ended question has a score', async () => {
    const seeded = await seedGenerated()
    const sheets = await repositories().printing.listSheets(seeded.applicationId)
    const { result } = renderHookWithProviders(() => ({
      read: useReadSheets(),
      confirm: useConfirmCorrection(),
    }))
    const [correction] = await act(() =>
      result.current.read.mutateAsync({
        applicationId: seeded.applicationId,
        sheetIds: [sheets[0]?.id ?? ''],
      }),
    )

    const confirmed = await act(() =>
      result.current.confirm.mutateAsync({
        correction: correction!,
        answers: [],
        objectiveResults: [
          { questionId: seeded.objectiveQuestionId, correct: true, score: 6 },
        ],
        discursiveScores: [{ questionId: seeded.discursiveQuestionId, score: 4 }],
        discursiveQuestionIds: [seeded.discursiveQuestionId],
      }),
    )

    expect(confirmed.status).toBe(CORRECTION_STATUS.DONE)
    expect(confirmed.totalScore).toBe(10)
  })

  /** Zero is a grade the teacher gave, not a grade that is missing. */
  it('treats a deliberate zero as a score that finishes the correction', async () => {
    const seeded = await seedGenerated()
    const sheets = await repositories().printing.listSheets(seeded.applicationId)
    const { result } = renderHookWithProviders(() => ({
      read: useReadSheets(),
      confirm: useConfirmCorrection(),
    }))
    const [correction] = await act(() =>
      result.current.read.mutateAsync({
        applicationId: seeded.applicationId,
        sheetIds: [sheets[0]?.id ?? ''],
      }),
    )

    const confirmed = await act(() =>
      result.current.confirm.mutateAsync({
        correction: correction!,
        answers: [],
        objectiveResults: [],
        discursiveScores: [{ questionId: seeded.discursiveQuestionId, score: 0 }],
        discursiveQuestionIds: [seeded.discursiveQuestionId],
      }),
    )

    expect(confirmed.status).toBe(CORRECTION_STATUS.DONE)
  })

  it('assigns a student to a correction that had none', async () => {
    const seeded = await seedApplicationChain()
    const { result: generate } = renderHookWithProviders(() => useGenerateApplication())
    await act(() =>
      generate.current.mutateAsync({
        id: seeded.applicationId,
        options: { ...GENERATE, withStudentIdentification: false },
      }),
    )
    const sheets = await repositories().printing.listSheets(seeded.applicationId)
    const students = await repositories().students.listByClass(seeded.classId)

    const { result } = renderHookWithProviders(() => ({
      read: useReadSheets(),
      assign: useAssignStudent(),
    }))
    const [correction] = await act(() =>
      result.current.read.mutateAsync({
        applicationId: seeded.applicationId,
        sheetIds: [sheets[0]?.id ?? ''],
      }),
    )

    const assigned = await act(() =>
      result.current.assign.mutateAsync({
        correctionId: correction?.id ?? '',
        studentId: students[0]?.id ?? '',
      }),
    )

    expect(assigned.studentId).toBe(students[0]?.id)
    expect(assigned.isAutomaticallyAssigned).toBe(false)
  })
})
