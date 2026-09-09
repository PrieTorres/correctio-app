import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useServices } from '../services'
import { renderHookWithProviders } from '@/test-utils'

describe('useServices', () => {
  it('exposes the repositories and the auth provider', () => {
    const { result } = renderHookWithProviders(() => useServices())

    expect(result.current.repositories.classes).toBeDefined()
    expect(result.current.repositories.students).toBeDefined()
    expect(result.current.auth).toBeDefined()
  })

  it('fails loudly when used outside the provider, instead of returning undefined', () => {
    expect(() => renderHook(() => useServices())).toThrow(/within <Providers>/)
  })
})
