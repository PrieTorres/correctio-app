import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useServices } from '@/app/services'
import type { SignInInput, SignUpInput } from '@/lib/schemas'

export const authKeys = {
  currentUser: ['auth', 'currentUser'] as const satisfies QueryKey,
}

export function useCurrentUser() {
  const { auth } = useServices()

  return useQuery({
    queryKey: authKeys.currentUser,
    queryFn: () => auth.getCurrentUser(),
  })
}

/** Shared invalidation so every mutation refreshes the session the layout reads. */
function useInvalidateCurrentUser() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: authKeys.currentUser })
}

export function useSignIn() {
  const { auth } = useServices()
  const invalidate = useInvalidateCurrentUser()

  return useMutation({
    mutationFn: ({ email, password }: SignInInput) => auth.signIn(email, password),
    onSuccess: invalidate,
  })
}

export function useSignUp() {
  const { auth } = useServices()
  const invalidate = useInvalidateCurrentUser()

  return useMutation({
    mutationFn: ({ fullName, email, password }: SignUpInput) => auth.signUp(fullName, email, password),
    onSuccess: invalidate,
  })
}

export function useSignOut() {
  const { auth } = useServices()
  const invalidate = useInvalidateCurrentUser()

  return useMutation({
    mutationFn: () => auth.signOut(),
    onSuccess: invalidate,
  })
}
