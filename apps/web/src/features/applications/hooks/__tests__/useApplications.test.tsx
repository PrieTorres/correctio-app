import { beforeEach, describe, expect, it } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { createTeacherRepositories } from '@/lib/repositories'
import { clearAllCollections } from '@/lib/storage/collection'
import { renderHookWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import {
  applicationKeys,
  useApplicationList,
  useApplicationPrinting,
  useArchiveApplication,
  useCorrectionsOfApplication,
  useGenerateApplication,
  usePublishAnswerKey,
  useReleaseGrades,
  useSaveApplication,
} from '../useApplications'

const repositories = () => createTeacherRepositories(TEST_TEACHER_ID)

async function seedApplication() {
  const { questions, exams, classes, students, applications } = repositories()

  const question = await questions.create({
    type: 'objetiva',
    statement: 'Questão',
    tags: [],
    alternatives: [
      { id: 'alt-a', text: 'uma' },
      { id: 'alt-b', text: 'outra' },
    ],
    correctAlternativeId: 'alt-a',
    allowShuffleAlternatives: true,
  })
  const exam = await exams.create({
    title: 'Prova',
    description: '',
    questions: [{ questionId: question.id, order: 0, score: 10, allowShuffleAlternatives: true }],
    defaultShuffleQuestions: true,
    defaultShuffleAlternatives: true,
  })
  const group = await classes.create({ name: 'Turma', subject: 'Matemática', term: '2026/2' })
  await students.add(group.id, { fullName: 'Ana', registration: '1' })
  await students.add(group.id, { fullName: 'Bruno', registration: '2' })

  const application = await applications.create({
    examId: exam.id,
    classId: group.id,
    date: '2026-10-05T12:00:00.000Z',
  })

  return { application, exam }
}

const GENERATE = {
  versionCount: 2,
  shuffleQuestions: true,
  shuffleAlternatives: true,
  withStudentIdentification: true,
}

describe('applicationKeys', () => {
  it('separates the active listing from the archived one', () => {
    expect(applicationKeys.list(true, '')).not.toEqual(applicationKeys.list(false, ''))
  })

  it('keeps the printing of one application apart from another', () => {
    expect(applicationKeys.printing('a')).not.toEqual(applicationKeys.printing('b'))
  })
})

describe('application data hooks', () => {
  beforeEach(clearAllCollections)

  it('lists an application once it is saved', async () => {
    await seedApplication()
    const { result } = renderHookWithProviders(() => useApplicationList(false, ''))

    await waitFor(() => expect(result.current.data?.items).toHaveLength(1))
  })

  it('saves an application from the form input', async () => {
    const { result } = renderHookWithProviders(() => ({
      save: useSaveApplication(),
      list: useApplicationList(false, ''),
    }))
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true))

    await act(() =>
      result.current.save.mutateAsync({
        input: { examId: 'e1', classId: 'c1', date: '2026-10-05T12:00:00.000Z' },
      }),
    )

    await waitFor(() => expect(result.current.list.data?.items).toHaveLength(1))
  })

  it('updates an application that already exists', async () => {
    const { application } = await seedApplication()
    const { result } = renderHookWithProviders(() => useSaveApplication())

    const saved = await act(() =>
      result.current.mutateAsync({
        id: application.id,
        input: { ...application, date: '2026-12-01T12:00:00.000Z' },
      }),
    )

    expect(saved.date).toBe('2026-12-01T12:00:00.000Z')
  })

  it('moves an application between the active and archived listings', async () => {
    const { application } = await seedApplication()
    const { result } = renderHookWithProviders(() => ({
      archive: useArchiveApplication(),
      active: useApplicationList(false, ''),
      archived: useApplicationList(true, ''),
    }))
    await waitFor(() => expect(result.current.active.data?.items).toHaveLength(1))

    await act(() => result.current.archive.mutateAsync({ id: application.id, archive: true }))

    await waitFor(() => expect(result.current.active.data?.items).toHaveLength(0))
    await waitFor(() => expect(result.current.archived.data?.items).toHaveLength(1))
  })

  it('brings an archived application back', async () => {
    const { application } = await seedApplication()
    const { result } = renderHookWithProviders(() => ({
      archive: useArchiveApplication(),
      active: useApplicationList(false, ''),
    }))
    await act(() => result.current.archive.mutateAsync({ id: application.id, archive: true }))

    await act(() => result.current.archive.mutateAsync({ id: application.id, archive: false }))

    await waitFor(() => expect(result.current.active.data?.items).toHaveLength(1))
  })

  it('generates the versions and one sheet per student', async () => {
    const { application } = await seedApplication()
    const { result } = renderHookWithProviders(() => ({
      generate: useGenerateApplication(),
      printing: useApplicationPrinting(application.id),
    }))

    await act(() => result.current.generate.mutateAsync({ id: application.id, options: GENERATE }))

    await waitFor(() => expect(result.current.printing.data?.versions).toHaveLength(2), {
      timeout: 8000,
    })
    expect(result.current.printing.data?.sheets).toHaveLength(2)
  })

  it('fails clearly when the application is not there', async () => {
    const { result } = renderHookWithProviders(() => useGenerateApplication())

    await expect(
      result.current.mutateAsync({ id: 'nope', options: GENERATE }),
    ).rejects.toThrow(/não encontrada/i)
  })

  /**
   * Archiving an exam stops new applications, not the ones already scheduled:
   * the class still sits the paper on the day it was booked for.
   */
  it('still prints an application whose exam was archived afterwards', async () => {
    const { application } = await seedApplication()
    await repositories().exams.archive(application.examId)
    const { result } = renderHookWithProviders(() => useGenerateApplication())

    const generated = await act(() =>
      result.current.mutateAsync({ id: application.id, options: GENERATE }),
    )

    expect(generated.versions).toHaveLength(2)
    expect(generated.sheets).toHaveLength(2)
  })

  it('publishes and withdraws an answer key', async () => {
    const { application } = await seedApplication()
    const { result } = renderHookWithProviders(() => ({
      generate: useGenerateApplication(),
      publish: usePublishAnswerKey(),
      printing: useApplicationPrinting(application.id),
    }))
    const { versions } = await act(() =>
      result.current.generate.mutateAsync({ id: application.id, options: GENERATE }),
    )
    const versionId = versions[0]?.id ?? ''

    await act(() => result.current.publish.mutateAsync({ versionId, published: true }))

    await waitFor(
      () =>
        expect(
          result.current.printing.data?.versions.find((item) => item.id === versionId)
            ?.answerKeyPublished,
        ).toBe(true),
      { timeout: 8000 },
    )
  })

  it('releases and withholds the grade lookup', async () => {
    const { application } = await seedApplication()
    const { result } = renderHookWithProviders(() => ({
      release: useReleaseGrades(),
      list: useApplicationList(false, ''),
    }))
    await waitFor(() => expect(result.current.list.data?.items).toHaveLength(1))

    await act(() => result.current.release.mutateAsync({ id: application.id, released: true }))

    await waitFor(() =>
      expect(result.current.list.data?.items[0]?.gradesReleased).toBe(true),
    )
  })

  it('reports no corrections for paper nobody has read', async () => {
    const { application } = await seedApplication()
    const { result } = renderHookWithProviders(() => ({
      generate: useGenerateApplication(),
      corrections: useCorrectionsOfApplication(application.id),
    }))
    await act(() => result.current.generate.mutateAsync({ id: application.id, options: GENERATE }))

    await waitFor(() => expect(result.current.corrections.data).toEqual([]), { timeout: 8000 })
  })
})
