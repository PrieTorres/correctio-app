import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { createTeacherRepositories, type TeacherRepositories } from '@/lib/repositories'
import { createLocalAuthProvider, type AuthProvider } from '@/lib/auth'

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

interface AppServices {
  repositories: TeacherRepositories
  auth: AuthProvider
}

const AppContext = createContext<AppServices | null>(null)

export function useServices(): AppServices {
  const services = useContext(AppContext)
  if (services === null) throw new Error('useServices must be used within <Providers>')
  return services
}

export function Providers({ children }: { children: ReactNode }) {
  const services = useMemo<AppServices>(() => {
    const auth = createLocalAuthProvider()
    return {
      auth,
      repositories: createTeacherRepositories(auth.getCurrentUser()?.id ?? 'teacher-demo'),
    }
  }, [])

  return (
    <AppContext.Provider value={services}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </AppContext.Provider>
  )
}
