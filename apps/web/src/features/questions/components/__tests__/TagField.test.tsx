import { beforeEach, describe, expect, it } from 'vitest'
import { useState } from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTeacherRepositories } from '@/lib/repositories'
import { clearAllCollections } from '@/lib/storage/collection'
import { renderWithProviders, TEST_TEACHER_ID } from '@/test-utils'
import { TagField } from '../TagField'

function Harness() {
  const [tags, setTags] = useState<string[]>([])
  return <TagField value={tags} onChange={setTags} />
}

async function seedTags(tags: string[]) {
  const questions = createTeacherRepositories(TEST_TEACHER_ID).questions
  for (const tag of tags) {
    await questions.create({
      type: 'discursiva',
      statement: `Questão de ${tag}`,
      tags: [tag],
      maxScore: 1,
      allowShuffleAlternatives: true,
    })
  }
}

const input = () => screen.getByLabelText('Tags de conteúdo')
const chosen = () => screen.queryAllByRole('button', { name: /^Remover tag / }).map((button) => button.parentElement?.textContent?.trim())

describe('TagField', () => {
  beforeEach(clearAllCollections)

  it('offers the tags the bank already uses', async () => {
    await seedTags(['Limites', 'Matrizes'])
    renderWithProviders(<Harness />)

    expect(await screen.findByRole('button', { name: 'Limites' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Matrizes' })).toBeVisible()
  })

  it('narrows the suggestions as the teacher types', async () => {
    await seedTags(['Limites', 'Matrizes', 'Derivadas'])
    const user = userEvent.setup()
    renderWithProviders(<Harness />)
    await screen.findByRole('button', { name: 'Limites' })

    await user.type(input(), 'Ma')

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Limites' })).toBeNull())
    expect(screen.getByRole('button', { name: 'Matrizes' })).toBeVisible()
  })

  it('ignores accents and case while narrowing', async () => {
    await seedTags(['Cálculo'])
    const user = userEvent.setup()
    renderWithProviders(<Harness />)
    await screen.findByRole('button', { name: 'Cálculo' })

    await user.type(input(), 'calc')

    expect(screen.getByRole('button', { name: 'Cálculo' })).toBeVisible()
  })

  it('adds a suggestion without committing the half-typed draft beside it', async () => {
    await seedTags(['Cálculo'])
    const user = userEvent.setup()
    renderWithProviders(<Harness />)
    await screen.findByRole('button', { name: 'Cálculo' })

    await user.type(input(), 'Cál')
    await user.click(screen.getByRole('button', { name: 'Cálculo' }))

    await waitFor(() => expect(chosen()).toEqual(['Cálculo']))
  })

  it('adopts the spelling the bank already has', async () => {
    await seedTags(['Cálculo'])
    const user = userEvent.setup()
    renderWithProviders(<Harness />)
    await screen.findByRole('button', { name: 'Cálculo' })

    await user.type(input(), 'calculo{Enter}')

    await waitFor(() => expect(chosen()).toEqual(['Cálculo']))
  })

  it('still accepts a tag the bank has never seen', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)

    await user.type(input(), 'Tópico novo{Enter}')

    await waitFor(() => expect(chosen()).toEqual(['Tópico novo']))
  })

  it('does not offer a tag that is already chosen', async () => {
    await seedTags(['Limites'])
    const user = userEvent.setup()
    renderWithProviders(<Harness />)
    await screen.findByRole('button', { name: 'Limites' })

    await user.click(screen.getByRole('button', { name: 'Limites' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Limites' })).toBeNull())
  })

  /** The database keys a question's tags ignoring case and accents, so the pair failed the save (#184). */
  it('keeps one tag when the next differs only in case or accents from one already chosen', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)

    await user.type(input(), 'Integrais{Enter}')
    await user.type(input(), 'integrais{Enter}')
    await user.type(input(), 'Função{Enter}')
    await user.type(input(), 'funcao{Enter}')

    await waitFor(() => expect(chosen()).toEqual(['Integrais', 'Função']))
    expect(input()).toHaveValue('')
  })

  /** `question_tags.tag` holds 80 characters; a longer one failed the save with a 500 (#184). */
  it('refuses a tag longer than 80 characters, saying why and keeping it to shorten', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)
    const long = 'a'.repeat(81)

    await user.type(input(), `${long}{Enter}`)

    expect(await screen.findByRole('alert')).toHaveTextContent('Cada tag pode ter no máximo 80 caracteres')
    expect(chosen()).toEqual([])
    expect(input()).toHaveValue(long)
    expect(input()).toHaveAttribute('aria-invalid', 'true')

    await user.type(input(), '{Backspace}{Enter}')

    await waitFor(() => expect(chosen()).toEqual(['a'.repeat(80)]))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows what the form refused about the chosen tags', () => {
    renderWithProviders(<TagField value={['Limites']} onChange={() => undefined} error="Uma tag repetida" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Uma tag repetida')
  })

  it('removes a chosen tag', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)
    await user.type(input(), 'Limites{Enter}')
    await waitFor(() => expect(chosen()).toEqual(['Limites']))

    await user.click(screen.getByRole('button', { name: 'Remover tag Limites' }))

    await waitFor(() => expect(chosen()).toEqual([]))
  })
})
