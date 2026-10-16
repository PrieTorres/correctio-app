import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfirmDialog } from '../ConfirmDialog'

const dialog = {
  open: true,
  onOpenChange: vi.fn(),
  title: 'Arquivar esta turma?',
  description: 'A turma sai das listas ativas.',
  confirmLabel: 'Arquivar',
  onConfirm: vi.fn(),
}

/** A refused archive or removal has to say so inside the dialog, which stays open, or it looks like it worked. */
describe('ConfirmDialog', () => {
  it('shows why the confirmed action failed', () => {
    render(<ConfirmDialog {...dialog} error={new Error('Não foi possível falar com o servidor.')} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor.')
  })

  it('shows no error until something fails', () => {
    render(<ConfirmDialog {...dialog} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
