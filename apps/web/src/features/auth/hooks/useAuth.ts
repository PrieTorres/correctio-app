import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type Query,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query'
import { useServices } from '@/app/services'
import { dropBackgroundJobs } from '@/lib/background-jobs'
import type { AuthProvider } from '@/lib/auth'
import type { SignInInput, SignUpInput } from '@/lib/schemas'
import type { AuthenticatedUser } from '@/types/domain'

export const authKeys = {
  currentUser: ['auth', 'currentUser'] as const satisfies QueryKey,
}

/**
 * The session, restored once when the app opens and kept until a sign-in or a
 * sign-out replaces it. Shared with the app root, which builds the teacher's
 * repositories from the same answer.
 */
export function currentUserQuery(auth: AuthProvider) {
  return queryOptions({
    queryKey: authKeys.currentUser,
    queryFn: () => auth.restoreSession(),
    staleTime: Infinity,
  })
}

export function useCurrentUser() {
  const { auth } = useServices()
  return useQuery(currentUserQuery(auth))
}

/**
 * The account as the server has it (P2, `GET /me`). Outside the `auth` keys on
 * purpose: it is the teacher's data, so it leaves the cache with everything
 * else when the session changes (`startSession`).
 */
export const accountKeys = {
  detail: ['account'] as const satisfies QueryKey,
}

export function useAccount() {
  const { auth } = useServices()
  return useQuery({ queryKey: accountKeys.detail, queryFn: () => auth.loadAccount() })
}

function isAccountData(query: Query): boolean {
  return query.queryKey[0] !== authKeys.currentUser[0]
}

/**
 * The session is replaced in place and everything the previous person loaded
 * leaves the cache, the files of their background jobs included, so a teacher
 * never sees, even for a moment, another teacher's data.
 *
 * The session query itself is never removed: whoever observes it, the app
 * root included, would keep the removed copy until something else re-rendered
 * it, and the root builds the teacher's repositories from it.
 */
function startSession(queryClient: QueryClient, user: AuthenticatedUser | null): void {
  queryClient.setQueryData(authKeys.currentUser, user)
  queryClient.removeQueries({ predicate: isAccountData })
  dropBackgroundJobs(queryClient)
}

/**
 * After a 401 from the API: every screen reloads what it shows, and the
 * session is asked again. A token that only expired comes back from the
 * cookie; a session that really ended sends the guard to the sign-in.
 */
export function recheckSession(queryClient: QueryClient): void {
  void queryClient.resetQueries({ predicate: isAccountData })
  void queryClient.invalidateQueries({ queryKey: authKeys.currentUser })
}

function useSessionStart() {
  const queryClient = useQueryClient()
  return (user: AuthenticatedUser | null) => startSession(queryClient, user)
}

export function useSignIn() {
  const { auth } = useServices()
  const onSuccess = useSessionStart()

  return useMutation({
    mutationFn: ({ email, password }: SignInInput) => auth.signIn(email, password),
    onSuccess,
  })
}

export function useSignUp() {
  const { auth } = useServices()
  const onSuccess = useSessionStart()

  return useMutation({
    mutationFn: ({ fullName, email, password }: SignUpInput) => auth.signUp(fullName, email, password),
    onSuccess,
  })
}

export function useCompleteGoogleSignIn() {
  const { auth } = useServices()
  const onSuccess = useSessionStart()

  return useMutation({
    mutationFn: (code: string) => auth.completeGoogleSignIn(code),
    onSuccess,
  })
}

/** Leaving clears the cache even when the server could not be reached: this browser is done with the session either way. */
export function useSignOut() {
  const { auth } = useServices()
  const end = useSessionStart()

  return useMutation({
    mutationFn: () => auth.signOut(),
    onSettled: () => end(null),
  })
}

/** RF04: every device, this one included. */
export function useSignOutEverywhere() {
  const { auth } = useServices()
  const end = useSessionStart()

  return useMutation({
    mutationFn: () => auth.signOutEverywhere(),
    onSuccess: () => end(null),
  })
}

export function useRequestPasswordReset() {
  const { auth } = useServices()
  return useMutation({ mutationFn: (email: string) => auth.requestPasswordReset(email) })
}

export function useResetPassword() {
  const { auth } = useServices()
  return useMutation({
    mutationFn: ({ code, password }: { code: string; password: string }) => auth.resetPassword(code, password),
  })
}

/** RF05: unlinks the account from the person, and ends the session. */
export function useAnonymizeAccount() {
  const { auth } = useServices()
  const end = useSessionStart()

  return useMutation({
    mutationFn: () => auth.anonymize(),
    onSuccess: () => end(null),
  })
}

/** Pending until the browser has left for Google, so the button cannot be pressed twice. */
export function useStartGoogleSignIn() {
  const { auth } = useServices()
  return useMutation({ mutationFn: () => auth.startGoogleSignIn() })
}
