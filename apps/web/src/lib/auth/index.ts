import type { Teacher } from '@/types/domain'

export interface AuthProvider {
  getCurrentUser: () => Teacher | null
  signIn: (email: string, password: string) => Promise<Teacher>
  signUp: (name: string, email: string, password: string) => Promise<Teacher>
  signOut: () => Promise<void>
}

const SESSION_KEY = 'correctio:v1:session'

const DEMO_TEACHER: Teacher = {
  id: 'teacher-demo',
  name: 'Professora Ana Ribeiro',
  email: 'ana.ribeiro@exemplo.edu.br',
}

/**
 * Stand-in used while the app is a static site.
 *
 * There is no access control here and there cannot be: everything runs in the
 * visitor's browser. This exists so the interface is already in place for the
 * Firebase implementation, where the server validates every token.
 */
export function createLocalAuthProvider(): AuthProvider {
  const persist = (teacher: Teacher): Teacher => {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(teacher))
    return teacher
  }

  return {
    getCurrentUser() {
      try {
        const raw = window.localStorage.getItem(SESSION_KEY)
        return raw === null ? null : (JSON.parse(raw) as Teacher)
      } catch {
        return null
      }
    },
    async signIn(email) {
      return persist({ ...DEMO_TEACHER, email })
    },
    async signUp(name, email) {
      return persist({ id: DEMO_TEACHER.id, name, email })
    },
    async signOut() {
      window.localStorage.removeItem(SESSION_KEY)
    },
  }
}
