import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BackLink } from '../BackLink'

/** #145: the way back is named by where it leads, and is as tall as any other control. */
describe('BackLink', () => {
  it('is a link named by where it leads, with the arrow left out of the name', () => {
    render(
      <MemoryRouter>
        <BackLink to="/turmas">Turmas</BackLink>
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: 'Turmas' })
    expect(link).toHaveAttribute('href', '/turmas')
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('carries the 44 px height of a text link', () => {
    render(
      <MemoryRouter>
        <BackLink to="/aplicacoes">Aplicações</BackLink>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Aplicações' })).toHaveClass('link-target')
  })
})
