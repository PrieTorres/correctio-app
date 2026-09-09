import { createContext, useContext } from 'react'
import type { TeacherRepositories } from '@/lib/repositories'
import type { AuthProvider } from '@/lib/auth'

export interface AppServices {
  repositories: TeacherRepositories
  auth: AuthProvider
}

export const AppServicesContext = createContext<AppServices | null>(null)

/** Access to the repositories and the auth provider wired at the app root. */
export function useServices(): AppServices {
  const services = useContext(AppServicesContext)
  if (services === null) throw new Error('useServices must be used within <Providers>')
  return services
}
