import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useMemo, type ReactNode } from 'react'
import { currentUserQuery, recheckSession } from '@/features/auth/hooks/useAuth'
import { DEMO_MODE } from '@/lib/app-mode'
import { createHttpAuthProvider, createLocalAuthProvider } from '@/lib/auth'
import {
  createHttpPublicLookupRepository,
  createHttpTeacherRepositories,
  createLocalPublicLookupRepository,
  createLocalTeacherRepositories,
  type PublicLookupRepository,
  type TeacherRepositories,
} from '@/lib/repositories'
import { apiBaseUrl } from '@/lib/repositories/http/api-config'
import { createApiClient } from '@/lib/repositories/http/api-client'
import { createAppQueryClient } from './query-client'
import { AppServicesContext } from './services'

/**
 * Remote data lives in the query cache, never in component state or a global
 * store. Treating `localStorage` as server state from day one is what makes
 * swapping in the HTTP adapter a no-op for every screen.
 */
const queryClient = createAppQueryClient()

const auth = DEMO_MODE ? createLocalAuthProvider() : createHttpAuthProvider({ baseUrl: apiBaseUrl() })

/** On any 401 nothing read under the session is kept, and the session is checked again (`recheckSession`). */
const api = createApiClient({
  baseUrl: apiBaseUrl(),
  getToken: () => auth.getAccessToken(),
  onUnauthorized: () => recheckSession(queryClient),
})

/**
 * Decided by the build, not at run time (#51): `DEMO_MODE` is a constant, so
 * the Firebase bundle keeps only the HTTP side, and the repositories of the
 * browser, the seed and the local sign-in never reach it. The demo has no API
 * and keeps everything in the browser.
 */
function servicesFor(teacherId: string): { repositories: TeacherRepositories; publicLookup: PublicLookupRepository } {
  if (DEMO_MODE) {
    const repositories = createLocalTeacherRepositories(teacherId)
    return { repositories, publicLookup: createLocalPublicLookupRepository(repositories) }
  }
  return { repositories: createHttpTeacherRepositories(api), publicLookup: createHttpPublicLookupRepository(api) }
}

/** Teacher id of the repositories while nobody is signed in; the guard keeps every screen that reads them closed. */
const SIGNED_OUT = ''

/**
 * The repositories belong to whoever is signed in, so they are rebuilt when the
 * session changes, derived from the same query the screens read.
 */
function TeacherServices({ children }: Readonly<{ children: ReactNode }>) {
  const { data: user } = useQuery(currentUserQuery(auth))
  const teacherId = user?.id ?? SIGNED_OUT
  const services = useMemo(() => ({ auth, ...servicesFor(teacherId) }), [teacherId])

  return <AppServicesContext.Provider value={services}>{children}</AppServicesContext.Provider>
}

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <QueryClientProvider client={queryClient}>
      <TeacherServices>{children}</TeacherServices>
    </QueryClientProvider>
  )
}
