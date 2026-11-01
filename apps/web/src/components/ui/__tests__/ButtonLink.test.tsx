import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Button } from '../Button'
import { ButtonLink } from '../ButtonLink'

/**
 * #141: a link drawn as a button is one control, not a button with a link
 * inside. The whole area navigates only if the `<a>` is the element that
 * carries the button's box, and the keyboard stops once only if there is no
 * second control around it.
 */
describe('ButtonLink', () => {
  it('is a single link, with no button around or inside it', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/aplicacoes/nova">Nova aplicação</ButtonLink>
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: 'Nova aplicação' })
    expect(link).toHaveAttribute('href', '/aplicacoes/nova')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('carries the 44 px target and the look of a button of the same variant', () => {
    render(
      <MemoryRouter>
        <ButtonLink variant="primary" to="/provas/nova">
          Nova prova
        </ButtonLink>
        <Button variant="primary">Salvar</Button>
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: 'Nova prova' })
    expect(link).toHaveClass('touch-target')
    expect(link.className).toBe(screen.getByRole('button', { name: 'Salvar' }).className)
  })

  it('passes the tour target and the icon to the link itself', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/provas/gerar" data-tour="generate" icon={<svg data-testid="icon" aria-hidden />}>
          Gerar automaticamente
        </ButtonLink>
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: 'Gerar automaticamente' })
    expect(link).toHaveAttribute('data-tour', 'generate')
    expect(link).toContainElement(screen.getByTestId('icon'))
  })
})
