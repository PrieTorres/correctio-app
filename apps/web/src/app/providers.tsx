import { QueryClientProvider } from '@tanstack/react-query'
import { useMemo, type ReactNode } from 'react'
import { createTeacherRepositories } from '@/lib/repositories'
import { apiBaseUrl } from '@/lib/repositories/http/api-config'
import { createApiClient } from '@/lib/repositories/http/api-client'
import { createLocalAuthProvider } from '@/lib/auth'
import { createAppQueryClient } from './query-client'
import { AppServicesContext, type AppServices } from './services'

/**
 * Remote data lives in the query cache, never in component state or a global
 * store. Treating `localStorage` as server state from day one is what makes
 * swapping in the HTTP adapter a no-op for every screen.
 */
const queryClient = createAppQueryClient()

/**
 * Wires the app root. The HTTP client takes its token from the auth provider
 * and, on any 401, drops the whole cache, so nothing read under one session is
 * shown under the next; #40 adds the refresh or the redirect to the sign-in.
 */
export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  const services = useMemo<AppServices>(() => {
    const auth = createLocalAuthProvider()
    const api = createApiClient({
      baseUrl: apiBaseUrl(),
      getToken: () => auth.getAccessToken(),
      onUnauthorized: () => queryClient.clear(),
    })
    return {
      auth,
      repositories: createTeacherRepositories(auth.getCurrentUser()?.id ?? 'teacher-demo', api),
    }
  }, [])

  return (
    <AppServicesContext.Provider value={services}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </AppServicesContext.Provider>
  )
}
