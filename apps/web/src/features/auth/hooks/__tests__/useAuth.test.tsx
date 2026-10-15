import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createLocalAuthProvider, type AuthProvider } from '@/lib/auth'
import { renderHookWithProviders, renderWithProviders } from '@/test-utils'
import {
  authKeys,
  recheckSession,
  useCompleteGoogleSignIn,
  useCurrentUser,
  useRequestPasswordReset,
  useResetPassword,
  useSignIn,
  useSignOut,
  useSignOutEverywhere,
  useSignUp,
  useStartGoogleSignIn,
} from '../useAuth'

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

  it('drops what the previous person loaded when someone signs in', async () => {
    const { result } = renderHookWithProviders(() => ({
      signIn: useSignIn(),
      queryClient: useQueryClient(),
      leftover: useQuery({ queryKey: ['classes'], queryFn: () => ['turma do anterior'] }),
    }))
    await waitFor(() => expect(result.current.leftover.data).toEqual(['turma do anterior']))

    await act(() => result.current.signIn.mutateAsync({ email: 'ana@example.br', password: 'secret1' }))

    expect(result.current.queryClient.getQueryData(['classes'])).toBeUndefined()
    expect(result.current.queryClient.getQueryData(authKeys.currentUser)).toMatchObject({ email: 'ana@example.br' })
  })

  it('ends the session everywhere and forgets the user', async () => {
    const { result } = renderHookWithProviders(() => ({
      signIn: useSignIn(),
      signOutEverywhere: useSignOutEverywhere(),
      currentUser: useCurrentUser(),
    }))
    await act(() => result.current.signIn.mutateAsync({ email: 'ana@example.br', password: 'secret1' }))

    await act(() => result.current.signOutEverywhere.mutateAsync())

    await waitFor(() => expect(result.current.currentUser.data).toBeNull())
  })
})

/** Reads the session and nothing else, so it re-renders only when the session query tells it to, like the app root. */
function SessionReader() {
  const { data } = useCurrentUser()
  return <p>{data === undefined ? 'carregando' : (data?.email ?? 'ninguém')}</p>
}

function SignInButton() {
  const signIn = useSignIn()
  return (
    <button type="button" onClick={() => signIn.mutate({ email: 'bia@example.br', password: 'secret1' })}>
      entrar
    </button>
  )
}

describe('the session as other components see it', () => {
  beforeEach(() => window.localStorage.clear())

  /**
   * The app root builds the teacher's repositories from this query and
   * re-renders for no other reason. Removing the query on sign-in left it on
   * the previous person, and data was written under the wrong owner.
   */
  it('reaches a reader that nothing else re-renders', async () => {
    renderWithProviders(
      <>
        <SessionReader />
        <SignInButton />
      </>,
    )
    await screen.findByText('ninguém')

    fireEvent.click(screen.getByText('entrar'))

    expect(await screen.findByText('bia@example.br')).toBeTruthy()
  })
})

describe('recheckSession', () => {
  it('drops the account data and asks for the session again', async () => {
    const { result } = renderHookWithProviders(() => ({
      queryClient: useQueryClient(),
      session: useCurrentUser(),
      data: useQuery({ queryKey: ['classes'], queryFn: () => ['turma'] }),
    }))
    await waitFor(() => expect(result.current.data.data).toEqual(['turma']))
    const invalidate = vi.spyOn(result.current.queryClient, 'invalidateQueries')
    const reset = vi.spyOn(result.current.queryClient, 'resetQueries')

    act(() => recheckSession(result.current.queryClient))

    expect(reset).toHaveBeenCalledOnce()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: authKeys.currentUser })
  })
})

describe('password reset and Google hooks', () => {
  function spyingAuth(): AuthProvider {
    const auth = createLocalAuthProvider()
    return {
      ...auth,
      requestPasswordReset: vi.fn(() => Promise.resolve()),
      resetPassword: vi.fn(() => Promise.resolve()),
      startGoogleSignIn: vi.fn(() => Promise.resolve()),
      completeGoogleSignIn: vi.fn(() =>
        Promise.resolve({ id: 'g', role: 'professor' as const, fullName: 'Bia', email: 'bia@gmail.com', createdAt: '2026-10-14T12:00:00.000Z' }),
      ),
    }
  }

  it('hands the e-mail and the code to the provider', async () => {
    const auth = spyingAuth()
    const { result } = renderHookWithProviders(() => ({ request: useRequestPasswordReset(), reset: useResetPassword() }), { auth })

    await act(() => result.current.request.mutateAsync('ana@example.br'))
    await act(() => result.current.reset.mutateAsync({ code: 'codigo', password: 'senha-nova-1' }))

    expect(auth.requestPasswordReset).toHaveBeenCalledWith('ana@example.br')
    expect(auth.resetPassword).toHaveBeenCalledWith('codigo', 'senha-nova-1')
  })

  it('starts the Google sign-in and takes the session it brings back', async () => {
    const auth = spyingAuth()
    const { result } = renderHookWithProviders(
      () => ({ start: useStartGoogleSignIn(), complete: useCompleteGoogleSignIn(), queryClient: useQueryClient() }),
      { auth },
    )

    await act(() => result.current.start.mutateAsync())
    await act(() => result.current.complete.mutateAsync('codigo'))

    expect(auth.startGoogleSignIn).toHaveBeenCalledOnce()
    expect(auth.completeGoogleSignIn).toHaveBeenCalledWith('codigo')
    expect(result.current.queryClient.getQueryData(authKeys.currentUser)).toMatchObject({ email: 'bia@gmail.com' })
  })
})
