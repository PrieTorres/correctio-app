import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTeacherRepositories } from '@/lib/repositories'
import { clearAllCollections } from '@/lib/storage/collection'
import { renderWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import { ExamFormPage } from '../ExamFormPage'

const repositories = () => createTeacherRepositories(TEST_TEACHER_ID)

async function seedBank() {
  const bank = repositories().questions
  await bank.create({
    type: 'objetiva',
    statement: 'Primeira questão',
    tags: ['Limites'],
    alternatives: [
      { id: 'a1', text: 'uma' },
      { id: 'a2', text: 'outra' },
    ],
    correctAlternativeId: 'a1',
    allowShuffleAlternatives: true,
  })
  await bank.create({
    type: 'discursiva',
    statement: 'Segunda questão',
    tags: ['Limites'],
    maxScore: 3,
    allowShuffleAlternatives: true,
  })
}

/** Adds the first `count` questions the picker offers. */
async function addFromBank(user: ReturnType<typeof userEvent.setup>, count: number) {
  await user.click(screen.getByRole('button', { name: /Adicionar do banco/ }))
  const drawer = await screen.findByRole('dialog')

  const boxes = await within(drawer).findAllByRole('checkbox')
  for (const box of boxes.slice(0, count)) {
    await user.click(box)
  }

  await user.click(within(drawer).getByRole('button', { name: /Adicionar selecionadas/ }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
}

describe('ExamFormPage', () => {
  beforeEach(async () => {
    clearAllCollections()
    await seedBank()
  })

  it('adds questions from the bank and counts them', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExamFormPage />)

    await addFromBank(user, 2)

    expect(screen.getByText(/2\/20 questões/)).toBeVisible()
  })

  it('recomputes the total as a score is typed', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExamFormPage />)
    await addFromBank(user, 1)

    const score = screen.getByLabelText('Pontuação da questão 1 de 1')
    await user.clear(score)
    await user.type(score, '4')

    await waitFor(() => expect(screen.getByText(/pontuação total 4/)).toBeVisible())
  })

  /**
   * The plan is explicit that the score total is shown but never enforced:
   * closing an exam on ten points is the teacher's decision.
   */
  it('saves an exam whose scores do not add up to ten', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExamFormPage />)

    await user.type(screen.getByLabelText('Título'), 'Prova que não fecha em 10')
    await addFromBank(user, 1)
    await user.click(screen.getByRole('button', { name: /Salvar prova/ }))

    await waitFor(async () => expect((await repositories().exams.list()).items).toHaveLength(1))
    const [exam] = (await repositories().exams.list()).items
    expect(exam?.questions).toHaveLength(1)
  })

  it('refuses to save without a title', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExamFormPage />)

    await user.click(screen.getByRole('button', { name: /Salvar prova/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Informe o título da prova')
  })

  it('reorders with the buttons and renumbers what the Spec stores', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExamFormPage />)
    await addFromBank(user, 2)
    const firstBefore = screen.getAllByRole('listitem')[0]?.textContent

    await user.click(screen.getByLabelText('Mover para baixo a questão 1 de 2'))

    await waitFor(() =>
      expect(screen.getAllByRole('listitem')[0]?.textContent).not.toBe(firstBefore),
    )
  })

  it('writes order from the position, so it survives a reorder', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExamFormPage />)
    await user.type(screen.getByLabelText('Título'), 'Prova reordenada')
    await addFromBank(user, 2)

    await user.click(screen.getByLabelText('Mover para baixo a questão 1 de 2'))
    await user.click(screen.getByRole('button', { name: /Salvar prova/ }))

    await waitFor(async () => expect((await repositories().exams.list()).items).toHaveLength(1))
    const [exam] = (await repositories().exams.list()).items
    expect(exam?.questions.map((entry) => entry.order)).toEqual([0, 1])
  })

  it('disables moving the first one up and the last one down', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExamFormPage />)
    await addFromBank(user, 2)

    expect(screen.getByLabelText('Mover para cima a questão 1 de 2')).toBeDisabled()
    expect(screen.getByLabelText('Mover para baixo a questão 2 de 2')).toBeDisabled()
  })

  it('offers a drag handle beside the buttons', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExamFormPage />)
    await addFromBank(user, 1)

    expect(screen.getByLabelText('Arrastar a questão 1 de 1')).toBeVisible()
  })

  it('removes a question from the exam without touching the bank', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExamFormPage />)
    await addFromBank(user, 1)

    await user.click(screen.getByLabelText('Remover a questão 1 de 1'))

    expect(screen.getByText(/0\/20 questões/)).toBeVisible()
    expect((await repositories().questions.list()).items).toHaveLength(2)
  })

  it('does not offer a question that is already in the exam', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExamFormPage />)
    await addFromBank(user, 1)

    await user.click(screen.getByRole('button', { name: /Adicionar do banco/ }))
    const drawer = await screen.findByRole('dialog')

    expect(within(drawer).queryByLabelText('Primeira questão')).toBeNull()
  })
})
