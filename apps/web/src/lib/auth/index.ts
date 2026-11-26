import type { TotpSetup } from '@/lib/schemas'
import { SIGN_IN_STATUS, type AuthenticatedUser } from '@/types/domain'
import { StorageError } from '@/lib/storage/errors'

export { createHttpAuthProvider } from './http-auth-provider'

/**
 * What the first step of a sign-in leads to: a session, or, for an account
 * with the second factor on, the challenge the code of the second step is
 * traded for.
 */
export type SignInOutcome =
  | { status: typeof SIGN_IN_STATUS.SIGNED_IN; user: AuthenticatedUser }
  | { status: typeof SIGN_IN_STATUS.SECOND_FACTOR; challenge: string }

export interface AuthProvider {
  /**
   * Who is signed in, from memory: `null` before the session is restored and
   * after it ends. Screens read the session through `useCurrentUser`; this is
   * for code that runs outside React, such as recording a correction.
   */
  getCurrentUser: () => AuthenticatedUser | null
  /** Picks the session up again when the app opens, from the refresh cookie. `null` when nobody is signed in. */
  restoreSession: () => Promise<AuthenticatedUser | null>
  /**
   * The access token the HTTP client sends as `Authorization: Bearer`, or `null`
   * without a session. It is kept in memory only, never in `localStorage`, where
   * any script on the page could read it.
   */
  getAccessToken: () => Promise<string | null>
  signIn: (email: string, password: string) => Promise<SignInOutcome>
  signUp: (fullName: string, email: string, password: string) => Promise<AuthenticatedUser>
  signOut: () => Promise<void>
  /** P2: the account of the session as the server has it now (`GET /me`), with its name, e-mail and type. */
  loadAccount: () => Promise<AuthenticatedUser>
  /** RF04: ends the session on every device, this one included. */
  signOutEverywhere: () => Promise<void>
  /** RF03: answers the same whether or not the address has an account. */
  requestPasswordReset: (email: string) => Promise<void>
  /** Sets a new password from the code of the e-mail link. */
  resetPassword: (code: string, password: string) => Promise<void>
  /** Whether "Entrar com Google" is offered; the demo has no server to talk to Google. */
  offersGoogle: boolean
  /** Leaves for Google's consent screen; the browser comes back to the sign-in page. */
  startGoogleSignIn: () => Promise<void>
  /** Trades the one-time code Google sign-in left in the address for a session. */
  completeGoogleSignIn: (code: string) => Promise<SignInOutcome>
  /** Whether the profile offers the second factor; the demo has no server to hold a secret. */
  offersTotp: boolean
  /** The second step of a sign-in: the challenge of the first and the current code of the authenticator app. */
  completeSecondFactor: (challenge: string, code: string) => Promise<AuthenticatedUser>
  /** Generates a secret and its QR Code; the factor stays off until `enableTotp` receives a code. */
  beginTotpSetup: () => Promise<TotpSetup>
  enableTotp: (code: string) => Promise<void>
  /** Turning it off takes a current code, so a session left open cannot remove the protection. */
  disableTotp: (code: string) => Promise<void>
  /**
   * RF05: replaces the name and the e-mail with markers and ends the session.
   *
   * The account is not deleted, and neither is anything made with it: classes,
   * exams and the statistics of every application stay as they are. What goes
   * is the link between them and a person.
   */
  anonymize: () => Promise<void>
}

/**
 * Outside the `correctio:v1:` prefix that `clearAllCollections` wipes, so
 * clearing the sample data empties the demo without signing its teacher out.
 */
const SESSION_KEY = 'correctio:demo-session'

export const DEMO_TEACHER: AuthenticatedUser = {
  id: 'teacher-demo',
  role: 'professor',
  fullName: 'Professora Ana Ribeiro',
  email: 'ana.ribeiro@exemplo.edu.br',
  createdAt: '2026-02-01T12:00:00.000Z',
}

const NO_GOOGLE = 'O login com o Google não está disponível na demonstração.'
const NO_TOTP = 'A verificação em duas etapas não está disponível na demonstração.'
const SIGNED_OUT = 'Faça login para continuar.'

/**
 * The demo of the GitHub Pages build (`lib/app-mode.ts`), which has no API.
 *
 * There is no access control here and there cannot be: everything runs in the
 * visitor's browser, and any e-mail and password sign the demo teacher in.
 */
export function createLocalAuthProvider(): AuthProvider {
  const persist = (user: AuthenticatedUser): AuthenticatedUser => {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(user))
    return user
  }

  const getCurrentUser = (): AuthenticatedUser | null => {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY)
      return raw === null ? null : (JSON.parse(raw) as AuthenticatedUser)
    } catch {
      return null
    }
  }

  const signOut = () => {
    window.localStorage.removeItem(SESSION_KEY)
    return Promise.resolve()
  }

  return {
    getCurrentUser,
    restoreSession: () => Promise.resolve(getCurrentUser()),
    /** Nothing here talks to a server, so there is no token to send. */
    getAccessToken: () => Promise.resolve(null),
    signIn: (email) => Promise.resolve({ status: SIGN_IN_STATUS.SIGNED_IN, user: persist({ ...DEMO_TEACHER, email }) }),
    signUp: (fullName, email) => Promise.resolve(persist({ ...DEMO_TEACHER, fullName, email })),
    signOut,
    signOutEverywhere: signOut,

    loadAccount() {
      const user = getCurrentUser()
      return user === null ? Promise.reject(new StorageError(SIGNED_OUT, 'unauthorized')) : Promise.resolve(user)
    },
    requestPasswordReset: () => Promise.resolve(),
    resetPassword: () => Promise.resolve(),
    offersGoogle: false,
    startGoogleSignIn: () => Promise.reject(new StorageError(NO_GOOGLE, 'failure')),
    completeGoogleSignIn: () => Promise.reject(new StorageError(NO_GOOGLE, 'failure')),
    offersTotp: false,
    completeSecondFactor: () => Promise.reject(new StorageError(NO_TOTP, 'failure')),
    beginTotpSetup: () => Promise.reject(new StorageError(NO_TOTP, 'failure')),
    enableTotp: () => Promise.reject(new StorageError(NO_TOTP, 'failure')),
    disableTotp: () => Promise.reject(new StorageError(NO_TOTP, 'failure')),

    anonymize() {
      const user = getCurrentUser()
      if (user !== null) {
        persist({
          ...user,
          fullName: 'Professor anonimizado',
          email: `anon-${user.id.slice(0, 8)}@removido.invalid`,
          anonymizedAt: new Date().toISOString(),
        })
      }

      window.localStorage.removeItem(SESSION_KEY)
      return Promise.resolve()
    },
  }
}
