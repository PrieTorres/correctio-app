import { beforeEach, describe, expect, it } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { renderHookWithProviders } from '@/test-utils'
import { authKeys, useCurrentUser, useSignIn, useSignOut, useSignUp } from '../useAuth'

describe('authKeys', () => {
  it('has a stable current user key', () => {
    expect(authKeys.currentUser).toEqual(['auth', 'currentUser'])
  })
})

describe('auth data hooks', () => {
  beforeEach(() => window.localStorage.clear())

  it('has nobody signed in before the first sign-in', async () => {
    const { result } = renderHookWithProviders(() => useCurrentUser())

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('reflects the signed-in user after sign in', async () => {
    const { result } = renderHookWithProviders(() => ({
      signIn: useSignIn(),
      currentUser: useCurrentUser(),
    }))

    await waitFor(() => expect(result.current.currentUser.isSuccess).toBe(true))
    await act(() =>
      result.current.signIn.mutateAsync({ email: 'ana@example.br', password: 'secret1' }),
    )

    await waitFor(() => expect(result.current.currentUser.data?.email).toBe('ana@example.br'))
  })

  it('reflects the new account after sign up', async () => {
    const { result } = renderHookWithProviders(() => ({
      signUp: useSignUp(),
      currentUser: useCurrentUser(),
    }))

    await waitFor(() => expect(result.current.currentUser.isSuccess).toBe(true))
    await act(() =>
      result.current.signUp.mutateAsync({
        fullName: 'Ana Ribeiro',
        email: 'ana@example.br',
        password: 'secret1',
        confirmPassword: 'secret1',
      }),
    )

    await waitFor(() => expect(result.current.currentUser.data?.fullName).toBe('Ana Ribeiro'))
  })

  it('clears the current user on sign out', async () => {
    const { result } = renderHookWithProviders(() => ({
      signIn: useSignIn(),
      signOut: useSignOut(),
      currentUser: useCurrentUser(),
    }))

    await act(() =>
      result.current.signIn.mutateAsync({ email: 'ana@example.br', password: 'secret1' }),
    )
    await waitFor(() => expect(result.current.currentUser.data).not.toBeNull())

    await act(() => result.current.signOut.mutateAsync())

    await waitFor(() => expect(result.current.currentUser.data).toBeNull())
  })
})
