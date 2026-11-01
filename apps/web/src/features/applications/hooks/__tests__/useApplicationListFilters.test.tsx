import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { APPLICATION_FILTER_PARAM } from '../../application-filter'
import { useApplicationListFilters } from '../useApplicationListFilters'

function renderAt(path: string) {
  const wrapper = ({ children }: Readonly<{ children: ReactNode }>) => (
    <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
  )
  return renderHook(() => ({ list: useApplicationListFilters(), location: useLocation() }), { wrapper })
}

const paramsOf = (search: string) => new URLSearchParams(search)

describe('useApplicationListFilters', () => {
  it('reads the class, exam and paper filters from the URL', () => {
    const { result } = renderAt('/aplicacoes?class=c1&exam=e1&pdf=generated')

    expect(result.current.list.filters).toEqual({ classId: 'c1', examId: 'e1', pdf: 'generated' })
  })

  /** The situation of #158 lives in the same URL and has to survive any change here. */
  it('writes a chosen filter to the URL and keeps the situation', () => {
    const { result } = renderAt(`/aplicacoes?${APPLICATION_FILTER_PARAM}=archived`)

    act(() => result.current.list.setFilter('classId', 'c1'))

    expect(paramsOf(result.current.location.search).get('class')).toBe('c1')
    expect(paramsOf(result.current.location.search).get(APPLICATION_FILTER_PARAM)).toBe('archived')
    expect(result.current.list.filters.classId).toBe('c1')
  })

  it('takes a filter set back to "Todas" out of the URL instead of leaving it empty', () => {
    const { result } = renderAt('/aplicacoes?exam=e1')

    act(() => result.current.list.setFilter('examId', ''))

    expect(paramsOf(result.current.location.search).has('exam')).toBe(false)
  })

  it('clears every filter and keeps the situation', () => {
    const { result } = renderAt(`/aplicacoes?${APPLICATION_FILTER_PARAM}=active&class=c1&exam=e1&pdf=draft`)

    act(() => result.current.list.clear())

    expect(result.current.location.search).toBe(`?${APPLICATION_FILTER_PARAM}=active`)
  })
})
