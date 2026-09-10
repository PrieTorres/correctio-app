import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTeacherRepositories } from '@/lib/repositories'
import { clearAllCollections } from '@/lib/storage/collection'
import { renderWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import { QuestionFormPage } from '../QuestionFormPage'

/**
 * These cover one invariant Cypress cannot reach until CI runs: the id bound
 * to the "correct alternative" radio has to be the same id the schema compares
 * against `correctAlternativeId`. When `useFieldArray` owned the `id` key the
 * two drifted apart and no multiple-choice question could be saved at all.
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
