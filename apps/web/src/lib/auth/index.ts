import type { AuthenticatedUser } from '@/types/domain'

export interface AuthProvider {
  getCurrentUser: () => AuthenticatedUser | null
  signIn: (email: string, password: string) => Promise<AuthenticatedUser>
  signUp: (fullName: string, email: string, password: string) => Promise<AuthenticatedUser>
  signOut: () => Promise<void>
}

const SESSION_KEY = 'correctio:v1:session'

const DEMO_TEACHER: AuthenticatedUser = {
  id: 'teacher-demo',
  role: 'professor',
  fullName: 'Professora Ana Ribeiro',
  email: 'ana.ribeiro@exemplo.edu.br',
  createdAt: '2026-02-01T12:00:00.000Z',
}

/**
 * Stand-in used while the app is a static site.
 *
 * There is no access control here and there cannot be: everything runs in the
 * visitor's browser. This exists so the interface is already in place for the
 * Firebase implementation, where the server validates every token.
 */
export function createLocalAuthProvider(): AuthProvider {
  const persist = (user: AuthenticatedUser): AuthenticatedUser => {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(user))
    return user
  }

  return {
    getCurrentUser() {
      try {
        const raw = window.localStorage.getItem(SESSION_KEY)
        return raw === null ? null : (JSON.parse(raw) as AuthenticatedUser)
      } catch {
        return null
      }
    },
    signIn(email) {
      return Promise.resolve(persist({ ...DEMO_TEACHER, email }))
    },
    signUp(fullName, email) {
      return Promise.resolve(persist({ ...DEMO_TEACHER, fullName, email }))
    },
    signOut() {
      window.localStorage.removeItem(SESSION_KEY)
      return Promise.resolve()
    },
  }
}
