import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMemo, type ReactNode } from 'react'
import { createTeacherRepositories } from '@/lib/repositories'
import { createLocalAuthProvider } from '@/lib/auth'
import { AppServicesContext, type AppServices } from './services'

/**
 * Remote data lives in the query cache, never in component state or a global
 * store. Treating `localStorage` as server state from day one is what makes
 * swapping in the HTTP adapter a no-op for every screen.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})

export function Providers({ children }: { children: ReactNode }) {
  const services = useMemo<AppServices>(() => {
    const auth = createLocalAuthProvider()
    return {
      auth,
      repositories: createTeacherRepositories(auth.getCurrentUser()?.id ?? 'teacher-demo'),
    }
  }, [])

  return (
    <AppServicesContext.Provider value={services}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </AppServicesContext.Provider>
  )
}
