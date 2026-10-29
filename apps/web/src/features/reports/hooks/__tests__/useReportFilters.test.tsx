import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useReportFilters } from '../useReportFilters'

function renderAt(path: string) {
  const wrapper = ({ children }: Readonly<{ children: ReactNode }>) => (
    <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
  )
  return renderHook(() => ({ report: useReportFilters(), location: useLocation() }), { wrapper })
}

describe('useReportFilters', () => {
  it('reads the filters from the URL', () => {
    const { result } = renderAt('/reports?class=c1&subject=Física&from=2026-03-01')

    expect(result.current.report.filters).toEqual({
      classId: 'c1',
      subject: 'Física',
      term: '',
      from: '2026-03-01',
      to: '',
    })
  })

  it('writes a filter to the URL and keeps the others', () => {
    const { result } = renderAt('/reports?class=c1')

    act(() => result.current.report.setFilter('term', '1º bimestre'))

    const params = new URLSearchParams(result.current.location.search)
    expect(params.get('term')).toBe('1º bimestre')
    expect(params.get('class')).toBe('c1')
  })

  it('removes a filter from the URL when it is set to empty', () => {
    const { result } = renderAt('/reports?class=c1&term=x')

    act(() => result.current.report.setFilter('classId', ''))

    const params = new URLSearchParams(result.current.location.search)
    expect(params.has('class')).toBe(false)
    expect(params.get('term')).toBe('x')
  })

  it('clears every filter but leaves unrelated parameters alone', () => {
    const { result } = renderAt('/reports?class=c1&subject=s&term=t&from=2026-01-01&to=2026-02-01&tab=2')

    act(() => result.current.report.clear())

    const params = new URLSearchParams(result.current.location.search)
    expect([...params.keys()]).toEqual(['tab'])
    expect(result.current.report.filters.classId).toBe('')
  })
})
