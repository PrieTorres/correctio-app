import { authenticatedUserSchema, authSessionSchema } from '@/lib/schemas'
import { toStorageError } from '@/lib/repositories/http/api-client'
import { StorageError } from '@/lib/storage/errors'
import type { AuthenticatedUser } from '@/types/domain'
import type { AuthProvider } from './index'

/** Renewed this long before it expires, so a request never leaves with a token that dies on the way. */
const RENEW_MARGIN_MS = 30_000

/** One refresh at a time across the tabs of this browser (`refreshAcrossTabs`). */
const REFRESH_LOCK = 'correctio:refresh'

/** Kept in the tab between leaving for Google and coming back (`startGoogleSignIn`). */
const GOOGLE_BINDING_KEY = 'correctio:google-binding'

const GENERIC_FAILURE = 'Não foi possível falar com o servidor. Tente de novo em instantes.'
const GOOGLE_NOT_FINISHED = 'O login com o Google não foi concluído. Tente de novo.'

interface Session {
  user: AuthenticatedUser
  accessToken: string
  expiresAt: number
}

export interface HttpAuthOptions {
  /** From `apiBaseUrl()`; the refresh cookie is scoped to `<baseUrl>/auth`. */
  baseUrl: string
  /** Swapped in tests, like the rest below; the browser's own otherwise. */
  fetchFn?: typeof fetch
  now?: () => number
  locks?: Pick<LockManager, 'request'>
  tabStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  navigate?: (url: string) => void
  origin?: string
}

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** SHA-256 as hex, the form the API stores and compares (`hashOpaqueToken` there). */
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

/**
 * The sign-in of the published sites, on the API's own sessions (#40).
 *
 * The access token lives only in this closure, never in storage any script
 * could read. The refresh token never reaches JavaScript at all: it travels in
 * an `httpOnly` cookie the browser sends to `/api/auth` by itself.
 */
export function createHttpAuthProvider({
  baseUrl,
  fetchFn = (input, init) => fetch(input, init),
  now = Date.now,
  locks = globalThis.navigator?.locks,
  tabStorage = globalThis.sessionStorage,
  navigate = (url) => window.location.assign(url),
  origin = globalThis.location?.origin ?? '',
}: HttpAuthOptions): AuthProvider {
  let session: Session | null = null
  let refreshing: Promise<AuthenticatedUser | null> | null = null

  async function send(method: 'GET' | 'POST', path: string, { body, token }: { body?: unknown; token?: string } = {}): Promise<unknown> {
    const headers = new Headers({ Accept: 'application/json' })
    if (body !== undefined) headers.set('Content-Type', 'application/json')
    if (token !== undefined) headers.set('Authorization', `Bearer ${token}`)

    let response: Response
    try {
      response = await fetchFn(`${baseUrl}${path}`, {
        method,
        headers,
        credentials: 'same-origin',
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (cause) {
      throw new StorageError(GENERIC_FAILURE, 'failure', { cause })
    }

    const payload = await readJson(response)
    if (!response.ok) throw toStorageError(response.status, payload)
    return payload
  }

  const post = (path: string, body?: unknown, token?: string) => send('POST', path, { body, token })

  /** The access token of the session, or the 401 a request without one would get anyway. */
  async function requireToken(): Promise<string> {
    const token = await getAccessToken()
    if (token === null) throw toStorageError(401, undefined)
    return token
  }

  function begin(payload: unknown): AuthenticatedUser {
    const parsed = authSessionSchema.safeParse(payload)
    if (!parsed.success) throw new StorageError(GENERIC_FAILURE, 'failure', { cause: parsed.error })

    const { user, accessToken, expiresIn } = parsed.data
    session = { user, accessToken, expiresAt: now() + expiresIn * 1000 }
    return user
  }

  /** A refused refresh means the session is over, which is an answer and not a failure. */
  async function refreshNow(): Promise<AuthenticatedUser | null> {
    try {
      return begin(await post('/auth/refresh'))
    } catch (error) {
      if (!(error instanceof StorageError) || error.code !== 'unauthorized') throw error
      session = null
      return null
    }
  }

  /**
   * Refresh tokens rotate, so two tabs refreshing with the same cookie would
   * look like a stolen token to the API. The lock makes the second tab wait
   * and then send the cookie the first one already renewed.
   */
  async function refreshWithLock(): Promise<AuthenticatedUser | null> {
    if (locks === undefined) return refreshNow()
    return await locks.request(REFRESH_LOCK, refreshNow)
  }

  /** Callers that ask while a refresh is on its way share it, inside this tab too. */
  function refreshAcrossTabs(): Promise<AuthenticatedUser | null> {
    const pending =
      refreshing ??
      refreshWithLock().finally(() => {
        refreshing = null
      })
    refreshing = pending
    return pending
  }

  async function getAccessToken(): Promise<string | null> {
    if (session === null) return null
    if (session.expiresAt - now() > RENEW_MARGIN_MS) return session.accessToken
    await refreshAcrossTabs()
    return session?.accessToken ?? null
  }

  async function endSession(path: string, token?: string): Promise<void> {
    try {
      await post(path, undefined, token)
    } finally {
      session = null
    }
  }

  return {
    getCurrentUser: () => session?.user ?? null,
    restoreSession: () => (session === null ? refreshAcrossTabs() : Promise.resolve(session.user)),
    getAccessToken,

    async signIn(email, password) {
      return begin(await post('/auth/login', { email, password }))
    },

    async signUp(fullName, email, password) {
      return begin(await post('/auth/register', { fullName, email, password }))
    },

    signOut: () => endSession('/auth/logout'),

    async signOutEverywhere() {
      const token = await getAccessToken()
      await endSession('/auth/logout-all', token ?? undefined)
    },

    async requestPasswordReset(email) {
      await post('/auth/forgot-password', { email })
    },

    async resetPassword(code, password) {
      await post('/auth/reset-password', { code, password })
    },

    offersGoogle: true,

    /**
     * The secret stays in this tab and only its hash goes to Google and back.
     * Exchanging the code takes the secret itself, so a code that reaches any
     * other browser, by a link someone was sent, is useless there.
     */
    async startGoogleSignIn() {
      const binding = randomSecret()
      tabStorage.setItem(GOOGLE_BINDING_KEY, binding)
      const query = new URLSearchParams({ returnTo: origin, binding: await sha256Hex(binding) })
      navigate(`${baseUrl}/auth/google?${query.toString()}`)
    },

    async completeGoogleSignIn(code) {
      const binding = tabStorage.getItem(GOOGLE_BINDING_KEY)
      tabStorage.removeItem(GOOGLE_BINDING_KEY)
      if (binding === null) throw new StorageError(GOOGLE_NOT_FINISHED, 'unauthorized')
      return begin(await post('/auth/google/exchange', { code, binding }))
    },

    /** `GET /me`: the account as the server has it now, not as it was when the session began. */
    async loadAccount() {
      const parsed = authenticatedUserSchema.safeParse(await send('GET', '/me', { token: await requireToken() }))
      if (!parsed.success) throw new StorageError(GENERIC_FAILURE, 'failure', { cause: parsed.error })
      return parsed.data
    },

    /**
     * `POST /me/anonymize` ends every session on the server. This one ends
     * only once the server has confirmed, so a failed request leaves the
     * teacher signed in to try again instead of signed out with the account
     * untouched.
     */
    async anonymize() {
      await post('/me/anonymize', undefined, await requireToken())
      session = null
    },
  }
}
