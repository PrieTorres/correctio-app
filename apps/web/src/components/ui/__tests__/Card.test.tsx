import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from '../Card'

/**
 * A card that leads somewhere has to look like it does before it is touched.
 *
 * The movement itself lives in the stylesheet, where reduced motion can drop
 * it; what this guards is that a card marked interactive really opts into it,
 * and that a plain card — a panel, a form section — does not.
 */
describe('Card', () => {
  it('lifts on hover only when it leads somewhere', () => {
    render(<Card interactive>Turma</Card>)

    expect(screen.getByText('Turma')).toHaveClass('card-interactive')
  })

  it('becomes the hover group, so the link inside answers to the whole card', () => {
    render(<Card interactive>Turma</Card>)

    expect(screen.getByText('Turma')).toHaveClass('group')
  })

  it('leaves a card that is only a panel alone', () => {
    render(<Card>Resumo</Card>)

    expect(screen.getByText('Resumo')).not.toHaveClass('card-interactive')
  })
})
