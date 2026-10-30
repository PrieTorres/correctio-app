import { beforeEach, describe, expect, it } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CORRECTION_SOURCE, CORRECTION_STATUS, type Correction } from '@/types/domain'
import { createTeacherRepositories } from '@/lib/repositories'
import { clearAllCollections, createCollection } from '@/lib/storage/collection'
import { correctionSchema } from '@/lib/schemas'
import { ROUTES } from '@/app/routes'
import type { AppServices } from '@/app/services'
import { renderWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import { ApplicationGeneratePage } from '../ApplicationGeneratePage'

const repositories = () => createTeacherRepositories(TEST_TEACHER_ID)

async function seedApplication() {
  const { questions, exams, classes, students, applications } = repositories()

  const question = await questions.create({
    type: 'objetiva',
    statement: 'Questão de teste',
    tags: [],
    alternatives: [
      { id: 'alt-a', text: 'uma' },
      { id: 'alt-b', text: 'outra' },
    ],
    correctAlternativeId: 'alt-a',
    allowShuffleAlternatives: true,
  })
  const exam = await exams.create({
    title: 'Prova de teste',
    description: '',
    questions: [{ questionId: question.id, order: 0, score: 10, allowShuffleAlternatives: true }],
    defaultShuffleQuestions: true,
    defaultShuffleAlternatives: true,
  })
  const group = await classes.create({ name: 'Turma', subject: 'Matemática', term: '2026/2' })
  await students.add(group.id, { fullName: 'Ana', registration: '1' })
  await students.add(group.id, { fullName: 'Bruno', registration: '2' })

  return applications.create({
    examId: exam.id,
    classId: group.id,
    date: '2026-10-05T12:00:00.000Z',
  })
}

function renderAt(applicationId: string, services: Partial<AppServices> = {}) {
  return renderWithProviders(
    <Routes>
      <Route path={ROUTES.applicationPdf} element={<ApplicationGeneratePage />} />
    </Routes>,
    { path: `/aplicacoes/${applicationId}/pdf`, services },
  )
}

describe('ApplicationGeneratePage', () => {
  beforeEach(clearAllCollections)

  /** RF17: the versions start from the exam's shuffling, so nothing can be generated before the exam arrives. */
  it('waits for the exam before offering to generate', async () => {
    const application = await seedApplication()
    const base = repositories()
    const examNeverArrives = { ...base, exams: { ...base.exams, getById: () => new Promise<never>(() => undefined) } }

    renderAt(application.id, { repositories: examNeverArrives })

    await screen.findByText('Carregando prova…')
    expect(screen.queryByRole('button', { name: 'Gerar PDF' })).toBeNull()
  })

  it('generates the versions asked for and one sheet per student', async () => {
    const application = await seedApplication()
    const user = userEvent.setup()
    renderAt(application.id)
    await screen.findByRole('heading', { name: 'Gerar PDF — Prova de teste' })

    const count = screen.getByLabelText('Quantas versões')
    await user.clear(count)
    await user.type(count, '2')
    await user.click(screen.getByRole('button', { name: 'Gerar PDF' }))

    await waitFor(
      async () => expect(await repositories().printing.listVersions(application.id)).toHaveLength(2),
      { timeout: 8000 },
    )
    expect(await repositories().printing.listSheets(application.id)).toHaveLength(2)
  })

  it('gives every sheet a code of its own, which the public lookup will resolve', async () => {
    const application = await seedApplication()
    const user = userEvent.setup()
    renderAt(application.id)
    await screen.findByRole('heading', { name: 'Gerar PDF — Prova de teste' })

    await user.click(screen.getByRole('button', { name: 'Gerar PDF' }))

    await waitFor(
      async () =>
        expect((await repositories().printing.listSheets(application.id)).length).toBeGreaterThan(0),
      { timeout: 8000 },
    )
    const codes = (await repositories().printing.listSheets(application.id)).map((s) => s.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('marks the application generated and the exam as applied', async () => {
    const application = await seedApplication()
    const user = userEvent.setup()
    renderAt(application.id)
    await screen.findByRole('heading', { name: 'Gerar PDF — Prova de teste' })

    await user.click(screen.getByRole('button', { name: 'Gerar PDF' }))

    await waitFor(
      async () =>
        expect((await repositories().applications.getById(application.id))?.status).toBe(
          'generated',
        ),
      { timeout: 8000 },
    )
    const exams = await repositories().exams.list()
    expect(exams.items[0]?.status).toBe('ready')
  })

  it('inherits the shuffle preferences from the exam on every version (RF17)', async () => {
    const application = await seedApplication()
    renderAt(application.id)
    await screen.findByRole('heading', { name: 'Gerar PDF — Prova de teste' })

    for (const version of [1, 2]) {
      expect(screen.getByLabelText(`Embaralhar questões da versão ${version}`)).toBeChecked()
      expect(screen.getByLabelText(`Embaralhar alternativas da versão ${version}`)).toBeChecked()
    }
  })

  it('records the shuffle of each version as it was switched (RF22)', async () => {
    const application = await seedApplication()
    const user = userEvent.setup()
    renderAt(application.id)
    await screen.findByRole('heading', { name: 'Gerar PDF — Prova de teste' })

    await user.click(screen.getByLabelText('Embaralhar questões da versão 2'))
    await user.click(screen.getByRole('button', { name: 'Gerar PDF' }))

    await waitFor(
      async () => expect(await repositories().printing.listVersions(application.id)).toHaveLength(2),
      { timeout: 8000 },
    )
    const versions = await repositories().printing.listVersions(application.id)
    expect(versions.map(({ shuffleQuestions, shuffleAlternatives }) => ({ shuffleQuestions, shuffleAlternatives }))).toEqual([
      { shuffleQuestions: true, shuffleAlternatives: true },
      { shuffleQuestions: false, shuffleAlternatives: true },
    ])
  })

  it('warns before replacing paper that already exists', async () => {
    const application = await seedApplication()
    const user = userEvent.setup()
    renderAt(application.id)
    await screen.findByRole('heading', { name: 'Gerar PDF — Prova de teste' })
    await user.click(screen.getByRole('button', { name: 'Gerar PDF' }))

    await waitFor(
      async () =>
        expect((await repositories().printing.listVersions(application.id)).length).toBeGreaterThan(
          0,
        ),
      { timeout: 8000 },
    )

    renderAt(application.id)
    expect(await screen.findByText(/já foi gerada/, undefined, { timeout: 8000 })).toBeVisible()
  })

  /**
   * A correction points at the version it was read from, so replacing the paper
   * would leave it describing a layout that no longer exists.
   */
  it('refuses to generate again once a sheet has been corrected', async () => {
    const application = await seedApplication()
    const user = userEvent.setup()
    renderAt(application.id)
    await screen.findByRole('heading', { name: 'Gerar PDF — Prova de teste' })
    await user.click(screen.getByRole('button', { name: 'Gerar PDF' }))
    await waitFor(
      async () =>
        expect((await repositories().printing.listSheets(application.id)).length).toBeGreaterThan(0),
      { timeout: 8000 },
    )

    const [sheet] = await repositories().printing.listSheets(application.id)
    const correction: Correction = {
      id: 'correction-1',
      examVersionId: sheet?.examVersionId ?? '',
      answerSheetId: sheet?.id ?? '',
      status: CORRECTION_STATUS.DONE,
      source: CORRECTION_SOURCE.MANUAL,
      objectiveResults: [],
      discursiveScores: [],
      totalScore: 10,
      confirmedAt: '2026-10-06T12:00:00.000Z',
      correctedBy: TEST_TEACHER_ID,
      isAutomaticallyAssigned: true,
      clientCorrectionId: 'client-correction-1',
      syncStatus: 'synced',
    }
    createCollection('corrections', correctionSchema).writeAll([correction])

    renderAt(application.id)

    expect(await screen.findByRole('alert', undefined, { timeout: 8000 })).toHaveTextContent(
      /já foi corrigida/,
    )
    await waitFor(
      () => expect(screen.getByRole('button', { name: /Gerar de novo/ })).toBeDisabled(),
      { timeout: 8000 },
    )
  })
})
