import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pagination } from '../Pagination'

describe('Pagination', () => {
  it('stays out of the way while everything fits one page', () => {
    const { container } = render(<Pagination page={1} pageSize={50} total={50} onPageChange={vi.fn()} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('says which part of the list is on screen', () => {
    render(<Pagination page={2} pageSize={50} total={73} onPageChange={vi.fn()} />)

    expect(screen.getByText('Mostrando 51–73 de 73')).toBeInTheDocument()
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument()
  })

  it('moves one page at a time in either direction', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Pagination page={2} pageSize={50} total={151} onPageChange={onPageChange} />)

    await user.click(screen.getByRole('button', { name: 'Próxima' }))
    await user.click(screen.getByRole('button', { name: 'Anterior' }))

    expect(onPageChange.mock.calls).toEqual([[3], [1]])
  })

  it('cannot go back from the first page or forward from the last', () => {
    const { rerender } = render(<Pagination page={1} pageSize={50} total={73} onPageChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()

    rerender(<Pagination page={2} pageSize={50} total={73} onPageChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()
  })
})
