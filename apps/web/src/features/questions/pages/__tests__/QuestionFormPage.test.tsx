import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { createTeacherRepositories } from '@/lib/repositories'
import { clearAllCollections } from '@/lib/storage/collection'
import { ROUTES } from '@/app/routes'
import { renderWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import { QuestionFormPage } from '../QuestionFormPage'

/**
 * Every case here failed silently before it was written, and none of them
 * reached anyone until CI ran the browser: a question that would not save, a
 * Zod message in English on a Portuguese screen, and one that saved and could
 * never be read back. They stay in jsdom so the next one fails on the machine
 * where it is written.
 */
describe('QuestionFormPage', () => {
  const statement = () => document.querySelector('#statement') as HTMLElement
  const saved = () => createTeacherRepositories(TEST_TEACHER_ID).questions.list()

  async function fillObjective(user: ReturnType<typeof userEvent.setup>) {
    await user.type(statement(), 'Qual a integral de 2x?')
    await user.type(screen.getByLabelText('Texto da alternativa A'), 'x² + C')
    await user.type(screen.getByLabelText('Texto da alternativa B'), '2')
  }

  it('marks the first alternative as correct from the start', () => {
    clearAllCollections()
    renderWithProviders(<QuestionFormPage />)

    expect(screen.getByLabelText('Alternativa A é a correta')).toBeChecked()
  })

  it('saves a multiple-choice question instead of rejecting its own default', async () => {
    clearAllCollections()
    const user = userEvent.setup()
    renderWithProviders(<QuestionFormPage />)

    await fillObjective(user)
    await user.click(screen.getByRole('button', { name: /Salvar questão/ }))

    await waitFor(async () => expect((await saved()).items).toHaveLength(1))
    expect(screen.queryByText('Marque qual alternativa é a correta')).toBeNull()
  })

  /**
   * `valueAsNumber` reports an empty field as `NaN`, which the schema accepts
   * as a number, so the friendly message never fired and Zod's own
   * "Expected number, received nan" reached a Portuguese screen.
   */
  it('asks for the missing max score in the language of the interface', async () => {
    clearAllCollections()
    const user = userEvent.setup()
    renderWithProviders(<QuestionFormPage />)

    await user.click(screen.getByLabelText('Discursiva'))
    await user.type(statement(), 'Explique o teorema fundamental do cálculo')
    await user.click(screen.getByRole('button', { name: /Salvar questão/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Informe a nota máxima da questão discursiva',
    )
  })

  it('saves an open-ended question once the max score is given', async () => {
    clearAllCollections()
    const user = userEvent.setup()
    renderWithProviders(<QuestionFormPage />)

    await user.click(screen.getByLabelText('Discursiva'))
    await user.type(statement(), 'Explique o teorema fundamental do cálculo')
    await user.type(screen.getByLabelText('Nota máxima'), '2.5')
    await user.click(screen.getByRole('button', { name: /Salvar questão/ }))

    await waitFor(async () => expect((await saved()).items).toHaveLength(1))
    expect((await saved()).items[0]?.maxScore).toBe(2.5)
  })

  it('stores the alternative the teacher actually marked', async () => {
    clearAllCollections()
    const user = userEvent.setup()
    renderWithProviders(<QuestionFormPage />)

    await fillObjective(user)
    await user.click(screen.getByLabelText('Alternativa B é a correta'))
    await user.click(screen.getByRole('button', { name: /Salvar questão/ }))

    await waitFor(async () => expect((await saved()).items).toHaveLength(1))
    const [question] = (await saved()).items
    expect(question?.correctAlternativeId).toBe(question?.alternatives?.[1]?.id)
  })
})

describe('QuestionFormPage, editing an existing question', () => {
  const saved = () => createTeacherRepositories(TEST_TEACHER_ID).questions.list()

  it('clears the alternatives when a question becomes open-ended', async () => {
    clearAllCollections()
    const repository = createTeacherRepositories(TEST_TEACHER_ID).questions
    const created = await repository.create({
      type: 'objetiva',
      statement: 'Questão que vai virar discursiva',
      tags: [],
      alternatives: [
        { id: 'alt-a', text: 'uma' },
        { id: 'alt-b', text: 'outra' },
      ],
      correctAlternativeId: 'alt-a',
      allowShuffleAlternatives: true,
    })
    const user = userEvent.setup()

    renderWithProviders(
      <Routes>
        <Route path={ROUTES.questionDetail} element={<QuestionFormPage />} />
      </Routes>,
      { path: `/questoes/${created.id}` },
    )

    await screen.findByDisplayValue('uma')
    await user.click(screen.getByLabelText('Discursiva'))
    await user.type(screen.getByLabelText('Nota máxima'), '3')
    await user.click(screen.getByRole('button', { name: /Salvar questão/ }))

    await waitFor(async () => {
      const [question] = (await saved()).items
      expect(question?.type).toBe('discursiva')
    })
    const [question] = (await saved()).items
    expect(question?.alternatives).toBeUndefined()
    expect(question?.correctAlternativeId).toBeUndefined()
    expect(question?.maxScore).toBe(3)
  })
})
