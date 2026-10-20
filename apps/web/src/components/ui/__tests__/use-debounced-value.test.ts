import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from '../use-debounced-value'

/** Moves the fake clock inside `act`, so the state the timer sets is applied before the next assertion. */
function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with the value it was given', () => {
    const { result } = renderHook(() => useDebouncedValue('cálculo'))

    expect(result.current).toBe('cálculo')
  })

  /** Typing "física" key by key sends one search, for the whole word, instead of six. */
  it('waits for the changes to pause before passing the last one on', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), {
      initialProps: { value: '' },
    })

    for (const typed of ['f', 'fi', 'fís', 'físi', 'físic', 'física']) {
      rerender({ value: typed })
      advance(SEARCH_DEBOUNCE_MS - 1)
      expect(result.current).toBe('')
    }

    advance(1)
    expect(result.current).toBe('física')
  })

  it('takes a delay of its own', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 50), {
      initialProps: { value: 'a' },
    })

    rerender({ value: 'b' })
    advance(50)

    expect(result.current).toBe('b')
  })
})
