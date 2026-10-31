import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { CheckboxField } from '../CheckboxField'

/** A form library's `register`, whose `ref` has to reach the box for the value to be read. */
function RegisteredHarness({ onSubmit }: Readonly<{ onSubmit: (value: boolean) => void }>) {
  const { register, handleSubmit } = useForm<{ shuffle: boolean }>({ defaultValues: { shuffle: false } })

  return (
    <form onSubmit={(event) => void handleSubmit((values) => onSubmit(values.shuffle))(event)}>
      <CheckboxField label="Embaralhar as questões" {...register('shuffle')} />
      <button type="submit">Salvar</button>
    </form>
  )
}

/** #145: the whole 44 px row is the target, not only the 16 px box. */
describe('CheckboxField', () => {
  it('toggles the box from its text, which names it', async () => {
    const user = userEvent.setup()
    render(<CheckboxField label="Incluir discursivas" />)

    await user.click(screen.getByText('Incluir discursivas'))

    expect(screen.getByRole('checkbox', { name: 'Incluir discursivas' })).toBeChecked()
  })

  it('makes the row the 44 px target', () => {
    render(<CheckboxField label="Incluir discursivas" />)

    expect(screen.getByText('Incluir discursivas').closest('label')).toHaveClass('min-h-11')
  })

  it('takes a longer accessible name that starts with the visible text', () => {
    render(<CheckboxField label="Embaralhar questões" aria-label="Embaralhar questões da versão 2" />)

    expect(screen.getByRole('checkbox', { name: 'Embaralhar questões da versão 2' })).toBeInTheDocument()
  })

  it('reaches a form library through its ref', async () => {
    const user = userEvent.setup()
    let submitted: boolean | undefined
    render(<RegisteredHarness onSubmit={(value) => (submitted = value)} />)

    await user.click(screen.getByText('Embaralhar as questões'))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(submitted).toBe(true)
  })
})
