import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NumberInput } from '../NumberInput'

function Harness({ onValueChange = vi.fn() }: Readonly<{ onValueChange?: (value: number) => void }>) {
  const [value, setValue] = useState(1)
  return (
    <NumberInput
      value={value}
      onValueChange={(next) => {
        setValue(next)
        onValueChange(next)
      }}
      step="0.1"
      label="Quantidade"
    />
  )
}

const field = () => screen.getByLabelText('Quantidade')

/**
 * A browser reports a number field as empty whenever its content is not yet a
 * valid number. Pushing that back through a controlled value rewrites the field
 * between keystrokes, which is how "2.5" became "25" and how clearing before
 * typing "2" left "20".
 */
describe('NumberInput', () => {
  it('keeps a decimal together while it is typed', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.clear(field())
    await user.type(field(), '2.5')

    expect(field()).toHaveValue(2.5)
  })

  it('reports the number typed after clearing, not one beside it', async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onValueChange={onValueChange} />)

    await user.clear(field())
    await user.type(field(), '2')

    expect(field()).toHaveValue(2)
    expect(onValueChange).toHaveBeenLastCalledWith(2)
  })

  it('reports nothing at all while the field sits empty', async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onValueChange={onValueChange} />)

    await user.clear(field())

    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('puts the last value back when the field is left empty', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.clear(field())
    await user.tab()

    expect(field()).toHaveValue(1)
  })

  it('carries its accessible name, since the visible text is shorter', () => {
    render(<Harness />)

    expect(field()).toHaveAccessibleName('Quantidade')
  })
})
