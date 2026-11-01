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

  /**
   * The form refused the save and said nothing: react-hook-form files a rule
   * about the array as a whole under `root` once its items are registered, and
   * the screen only read the message one level up.
   */
  it('says why it will not save, instead of refusing in silence', async () => {
    clearAllCollections()
    const user = userEvent.setup()
    renderWithProviders(<QuestionFormPage />)

    await user.type(statement(), 'Uma questão sem alternativas preenchidas')
    await user.click(screen.getByRole('button', { name: /Salvar questão/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Preencha o texto de todas as alternativas',
    )
    expect((await saved()).items).toHaveLength(0)
  })

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

  /** Each refusal of #184 shows its reason on the field, and nothing is saved. */
  describe('inputs the database cannot store as typed (#184)', () => {
    async function saveOpenEnded(user: ReturnType<typeof userEvent.setup>, maxScore: string) {
      await user.click(screen.getByLabelText('Discursiva'))
      await user.type(statement(), 'Explique o teorema fundamental do cálculo')
      await user.type(screen.getByLabelText('Nota máxima'), maxScore)
      await user.click(screen.getByRole('button', { name: /Salvar questão/ }))
    }

    it('refuses a max score with a third decimal instead of rounding it to zero', async () => {
      clearAllCollections()
      const user = userEvent.setup()
      renderWithProviders(<QuestionFormPage />)

      await saveOpenEnded(user, '0.001')

      expect(await screen.findByRole('alert')).toHaveTextContent('A nota máxima aceita no máximo 2 casas decimais')
      expect((await saved()).items).toHaveLength(0)
    })

    it('refuses a max score above 9999,99, saying the ceiling', async () => {
      clearAllCollections()
      const user = userEvent.setup()
      renderWithProviders(<QuestionFormPage />)

      await saveOpenEnded(user, '10000')

      expect(await screen.findByRole('alert')).toHaveTextContent('A nota máxima pode ser no máximo 9999,99')
      expect((await saved()).items).toHaveLength(0)
    })

    it('refuses a statement of only spaces, like an empty one', async () => {
      clearAllCollections()
      const user = userEvent.setup()
      renderWithProviders(<QuestionFormPage />)

      await user.type(statement(), '     ')
      await user.type(screen.getByLabelText('Texto da alternativa A'), 'uma')
      await user.type(screen.getByLabelText('Texto da alternativa B'), 'outra')
      await user.click(screen.getByRole('button', { name: /Salvar questão/ }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Informe o enunciado')
      expect((await saved()).items).toHaveLength(0)
    })
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

  /**
   * A browser kept the bank with no key on the tags, so a question stored
   * before #184 may carry two spellings of one tag. Editing it says which,
   * under the tags, instead of refusing the save in silence.
   */
  it('says which stored tags repeat each other, and saves once one is removed', async () => {
    clearAllCollections()
    const created = await createTeacherRepositories(TEST_TEACHER_ID).questions.create({
      type: 'discursiva',
      statement: 'Questão com tags repetidas',
      tags: ['Integrais', 'integrais'],
      maxScore: 2,
      allowShuffleAlternatives: true,
    })
    const user = userEvent.setup()

    renderWithProviders(
      <Routes>
        <Route path={ROUTES.questionDetail} element={<QuestionFormPage />} />
      </Routes>,
      { path: `/questoes/${created.id}` },
    )

    await screen.findByDisplayValue('Questão com tags repetidas')
    await user.click(screen.getByRole('button', { name: /Salvar questão/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('"Integrais" e "integrais" são a mesma tag: deixe só uma')

    await user.click(screen.getByRole('button', { name: 'Remover tag integrais' }))

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    await user.click(screen.getByRole('button', { name: /Salvar questão/ }))
    await waitFor(async () => expect((await saved()).items[0]?.tags).toEqual(['Integrais']))
  })
})
