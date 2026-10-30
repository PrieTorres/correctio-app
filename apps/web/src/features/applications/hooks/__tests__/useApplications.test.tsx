import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { createTeacherRepositories } from '@/lib/repositories'
import { clearAllCollections } from '@/lib/storage/collection'
import { renderHookWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import {
  applicationKeys,
  useApplication,
  useApplicationFilterChoices,
  useApplicationList,
  useApplicationPrinting,
  useArchiveApplication,
  useDownloadApplicationPdf,
  useGenerateApplication,
  usePrintedPaper,
  usePublishAllAnswerKeys,
  usePublishAnswerKey,
  useReleaseGrades,
  useSaveApplication,
  useSittingChoices,
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

const SHUFFLED = { shuffleQuestions: true, shuffleAlternatives: true }

const GENERATE = {
  versions: [SHUFFLED, SHUFFLED],
  withStudentIdentification: true,
}

describe('applicationKeys', () => {
  it('separates the active listing from the archived one', () => {
    expect(applicationKeys.list({ archived: true })).not.toEqual(applicationKeys.list({ archived: false }))
  })

  it('keeps the printing of one application apart from another', () => {
    expect(applicationKeys.printing('a')).not.toEqual(applicationKeys.printing('b'))
  })
})

describe('application data hooks', () => {
  beforeEach(clearAllCollections)

  /** P11 sends its filters along, and the repository answers the page already filtered. */
  it('lists only what the filters let through', async () => {
    const { application } = await seedApplication()
    await repositories().applications.create({ examId: 'another-exam', classId: application.classId, date: '2026-10-06T12:00:00.000Z' })

    const { result } = renderHookWithProviders(() => useApplicationList({ examId: application.examId }))

    await waitFor(() => expect(result.current.data?.items.map((item) => item.id)).toEqual([application.id]))
  })

  it('lists an application once it is saved', async () => {
    await seedApplication()
    const { result } = renderHookWithProviders(() => useApplicationList())

    await waitFor(() => expect(result.current.data?.items).toHaveLength(1))
  })

  it('saves an application from the form input', async () => {
    const { result } = renderHookWithProviders(() => ({
      save: useSaveApplication(),
      list: useApplicationList(),
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
      active: useApplicationList(),
      archived: useApplicationList({ archived: true }),
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
      active: useApplicationList(),
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

    await act(() => result.current.generate.mutateAsync({ id: application.id, request: GENERATE }))

    await waitFor(() => expect(result.current.printing.data?.versions).toHaveLength(2), {
      timeout: 8000,
    })
    expect(result.current.printing.data?.sheets).toHaveLength(2)
  })

  it('fails clearly when the application is not there', async () => {
    const { result } = renderHookWithProviders(() => useGenerateApplication())

    await expect(
      result.current.mutateAsync({ id: 'nope', request: GENERATE }),
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
      result.current.mutateAsync({ id: application.id, request: GENERATE }),
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
      result.current.generate.mutateAsync({ id: application.id, request: GENERATE }),
    )
    const versionId = versions[0]?.id ?? ''

    await act(() => result.current.publish.mutateAsync({ applicationId: application.id, versionId, published: true }))

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
      list: useApplicationList(),
    }))
    await waitFor(() => expect(result.current.list.data?.items).toHaveLength(1))

    await act(() => result.current.release.mutateAsync({ id: application.id, released: true }))

    await waitFor(() =>
      expect(result.current.list.data?.items[0]?.gradesReleased).toBe(true),
    )
  })

  it('reads an application with the exam, the class and what was printed for it', async () => {
    const { application } = await seedApplication()
    const { result } = renderHookWithProviders(() => ({
      generate: useGenerateApplication(),
      application: useApplication(application.id),
    }))
    await waitFor(() => expect(result.current.application.data?.examTitle).toBe('Prova'))

    await act(() => result.current.generate.mutateAsync({ id: application.id, request: GENERATE }))

    await waitFor(() => expect(result.current.application.data?.progress.versions).toBe(2), { timeout: 8000 })
    expect(result.current.application.data).toMatchObject({
      status: 'generated',
      className: 'Turma',
      progress: { versions: 2, publishedAnswerKeys: 0, sheets: 2, correctedSheets: 0, corrections: 0 },
    })
  })

  it('publishes the answer key of every version at once', async () => {
    const { application } = await seedApplication()
    const { result } = renderHookWithProviders(() => ({
      generate: useGenerateApplication(),
      publishAll: usePublishAllAnswerKeys(),
      application: useApplication(application.id),
    }))
    await act(() => result.current.generate.mutateAsync({ id: application.id, request: GENERATE }))

    await act(() => result.current.publishAll.mutateAsync(application.id))

    await waitFor(() => expect(result.current.application.data?.progress.publishedAnswerKeys).toBe(2), { timeout: 8000 })
  })
})

describe('useSittingChoices', () => {
  beforeEach(clearAllCollections)

  it('offers every active exam and class, leaving the archived ones out', async () => {
    await seedApplication()
    const { exams, classes } = repositories()
    const archivedExam = await exams.create({
      title: 'Prova antiga',
      description: '',
      questions: [],
      defaultShuffleQuestions: false,
      defaultShuffleAlternatives: false,
    })
    await exams.archive(archivedExam.id)
    const archivedClass = await classes.create({ name: 'Turma antiga', subject: 'Matemática', term: '2025/2' })
    await classes.archive(archivedClass.id)

    const { result } = renderHookWithProviders(() => useSittingChoices())

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.exams.map((item) => item.title)).toEqual(['Prova'])
    expect(result.current.data?.classes.map((item) => item.name)).toEqual(['Turma'])
  })

  /** The empty state of P12 sends the teacher to create an exam; coming back must read the list again. */
  it('is read again on the next visit, not served from the last one', async () => {
    await seedApplication()

    const { result } = renderHookWithProviders(() => useSittingChoices())

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.isStale).toBe(true)
  })
})

describe('useApplicationFilterChoices', () => {
  beforeEach(clearAllCollections)

  /** An application keeps its exam and class when they are archived later, and P11 still filters by them. */
  it('offers every exam and class, the archived ones included and marked', async () => {
    await seedApplication()
    const { exams, classes } = repositories()
    const archivedExam = await exams.create({
      title: 'Prova antiga',
      description: '',
      questions: [],
      defaultShuffleQuestions: false,
      defaultShuffleAlternatives: false,
    })
    await exams.archive(archivedExam.id)
    const archivedClass = await classes.create({ name: 'Turma antiga', subject: 'Matemática', term: '2025/2' })
    await classes.archive(archivedClass.id)

    const { result } = renderHookWithProviders(() => useApplicationFilterChoices())

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.exams.map((option) => option.label)).toEqual(['Prova', 'Prova antiga (arquivada)'])
    expect(result.current.data?.classes).toEqual([
      expect.objectContaining({ label: 'Turma' }),
      { value: archivedClass.id, label: 'Turma antiga (arquivada)' },
    ])
  })

  it('is read again on the next visit, not served from the last one', async () => {
    await seedApplication()

    const { result } = renderHookWithProviders(() => useApplicationFilterChoices())

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.isStale).toBe(true)
  })
})

describe('usePrintedPaper', () => {
  beforeEach(clearAllCollections)

  it('reads the versions and the sheets of an application once they exist', async () => {
    const { application } = await seedApplication()
    const { result } = renderHookWithProviders(() => ({
      generate: useGenerateApplication(),
      paper: usePrintedPaper(application.id),
    }))
    expect(result.current.paper).toEqual({ versions: [], sheets: [] })

    await act(() => result.current.generate.mutateAsync({ id: application.id, request: GENERATE }))

    await waitFor(() => expect(result.current.paper.versions).toHaveLength(2), { timeout: 8000 })
    expect(result.current.paper.sheets).toHaveLength(2)
  })

  /** A draft has nothing printed either, and its cards already say so. */
  it('reads as nothing printed when the paper cannot be read', async () => {
    const teacher = createTeacherRepositories(TEST_TEACHER_ID)
    const failing = () => Promise.reject(new Error('sem conexão'))
    const { result } = renderHookWithProviders(() => useApplicationPrinting('a1'), {
      repositories: { ...teacher, printing: { ...teacher.printing, listVersions: failing, listSheets: failing } },
    })
    const paper = renderHookWithProviders(() => usePrintedPaper('a1'), {
      repositories: { ...teacher, printing: { ...teacher.printing, listVersions: failing, listSheets: failing } },
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(paper.result.current).toEqual({ versions: [], sheets: [] })
  })
})

describe('useDownloadApplicationPdf', () => {
  const createObjectURL = vi.fn(() => 'blob:prova')

  /** jsdom has no object URLs, so the test supplies the ones the browser would. */
  beforeEach(() => {
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('saves the PDF of the application under the name it came with', async () => {
    const saved: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push(this.download)
    })
    const teacher = createTeacherRepositories(TEST_TEACHER_ID)
    const downloadPdf = vi.fn(() => Promise.resolve({ blob: new Blob(['%PDF-1.7']), filename: 'prova-2026-10-05.pdf' }))
    const { result } = renderHookWithProviders(() => useDownloadApplicationPdf(), {
      repositories: { ...teacher, applications: { ...teacher.applications, downloadPdf } },
    })

    await act(() => result.current.mutateAsync('a1'))

    expect(downloadPdf).toHaveBeenCalledWith('a1')
    expect(saved).toEqual(['prova-2026-10-05.pdf'])
  })

  it('reports what the repository said when there is no PDF to save', async () => {
    const { result } = renderHookWithProviders(() => useDownloadApplicationPdf())

    await expect(result.current.mutateAsync('a1')).rejects.toThrow('O PDF é montado pelo servidor e não existe nesta demonstração.')
  })
})
