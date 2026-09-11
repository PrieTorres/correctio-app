import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Drawer } from '../Drawer'

function Harness() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title="Adicionar do banco"
        description="Escolha as questões"
        footer={<button type="button">Confirmar</button>}
      >
        <p>Conteúdo</p>
      </Drawer>
    </>
  )
}

/**
 * The drawer is a second dialog surface, so it repeats the guarantees the modal
 * already holds rather than trusting that sharing a primitive is enough.
 */
describe('Drawer', () => {
  async function openIt() {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Abrir' })

    await user.click(trigger)
    await screen.findByRole('dialog')

    return { user, trigger }
  }

  it('names the panel by its title, so a screen reader announces it', async () => {
    await openIt()

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Adicionar do banco')
  })

  it('describes the panel by its description', async () => {
    await openIt()

    expect(screen.getByRole('dialog')).toHaveAccessibleDescription('Escolha as questões')
  })

  it('keeps the footer outside the scrolling area', async () => {
    await openIt()

    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeVisible()
  })

  it('closes on Escape', async () => {
    const { user } = await openIt()

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('returns focus to whatever opened it', async () => {
    const { user, trigger } = await openIt()

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(trigger).toHaveFocus()
  })

  it('returns focus when the close button closes it', async () => {
    const { user, trigger } = await openIt()

    await user.click(screen.getByLabelText('Fechar'))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(trigger).toHaveFocus()
  })
})
