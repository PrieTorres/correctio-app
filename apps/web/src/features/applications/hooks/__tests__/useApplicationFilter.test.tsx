import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { APPLICATION_FILTER, APPLICATION_FILTER_PARAM } from '../../application-filter'
import { useApplicationFilter } from '../useApplicationFilter'

function renderAt(path: string) {
  const wrapper = ({ children }: Readonly<{ children: ReactNode }>) => (
    <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
  )
  return renderHook(() => ({ filter: useApplicationFilter(), location: useLocation() }), { wrapper })
}

describe('useApplicationFilter', () => {
  it('reads the filter from the URL', () => {
    const { result } = renderAt(`/applications?${APPLICATION_FILTER_PARAM}=${APPLICATION_FILTER.IN_PROGRESS}`)

    expect(result.current.filter[0]).toBe(APPLICATION_FILTER.IN_PROGRESS)
  })

  it('falls back to the active filter when the URL has none', () => {
    const { result } = renderAt('/applications')

    expect(result.current.filter[0]).toBe(APPLICATION_FILTER.ACTIVE)
  })

  it('writes the chosen filter to the URL and keeps the other parameters', () => {
    const { result } = renderAt('/applications?q=prova')

    act(() => result.current.filter[1](APPLICATION_FILTER.ARCHIVED))

    const params = new URLSearchParams(result.current.location.search)
    expect(params.get(APPLICATION_FILTER_PARAM)).toBe(APPLICATION_FILTER.ARCHIVED)
    expect(params.get('q')).toBe('prova')
    expect(result.current.filter[0]).toBe(APPLICATION_FILTER.ARCHIVED)
  })
})
