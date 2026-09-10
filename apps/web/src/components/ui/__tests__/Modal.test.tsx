import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from '../Modal'

/**
 * Radix returns focus to `Dialog.Trigger`, which these dialogs do not use: they
 * are opened by whatever component holds the state. Without the restore added
 * to `Modal`, closing any dialog dropped focus onto `body` and keyboard
 * navigation restarted from the top of the page.
 */
function Harness() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <Modal open={open} onOpenChange={setOpen} title="Título do diálogo">
        <p>Conteúdo</p>
      </Modal>
    </>
  )
}

describe('Modal', () => {
  async function openIt() {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Abrir' })

    await user.click(trigger)
    await screen.findByRole('dialog')

    return { user, trigger }
  }

  it('returns focus to whatever opened it when Escape closes it', async () => {
    const { user, trigger } = await openIt()

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(trigger).toHaveFocus()
  })

  it('returns focus to whatever opened it when the close button closes it', async () => {
    const { user, trigger } = await openIt()

    await user.click(screen.getByLabelText('Fechar'))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(trigger).toHaveFocus()
  })

  it('names the dialog by its title, so a screen reader announces it', async () => {
    await openIt()

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Título do diálogo')
  })
})
