import { describe, expect, it, vi } from 'vitest'
import { StorageError } from '@/lib/storage/errors'
import { createHttpAuthProvider, type HttpAuthOptions } from '../http-auth-provider'

const USER = {
  id: 'ana',
  role: 'professor',
  fullName: 'Ana Lima',
  email: 'ana@exemplo.edu.br',
  createdAt: '2026-10-14T12:00:00.000Z',
}

function sessionBody(accessToken = 'token-1', expiresIn = 900) {
  return { accessToken, expiresIn, user: USER }
}

function json(status: number, body?: unknown): Response {
  return body === undefined ? new Response(null, { status }) : Response.json(body, { status })
}

/** A tab's storage, kept in a map so a test can read what was left in it. */
function memoryStorage() {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  }
}

function setup(responses: Response[], options: Partial<HttpAuthOptions> = {}) {
  const fetchFn = vi.fn<typeof fetch>()
  for (const response of responses) fetchFn.mockResolvedValueOnce(response)
  let clock = 0
  const navigate = vi.fn<(url: string) => void>()
  const tabStorage = memoryStorage()
  const auth = createHttpAuthProvider({
    baseUrl: '/api',
    fetchFn,
    now: () => clock,
    locks: undefined,
    tabStorage,
    navigate,
    origin: 'https://correctio-app.web.app',
    ...options,
  })
  const advance = (ms: number) => {
    clock += ms
  }
  return { auth, fetchFn, navigate, tabStorage, advance }
}

function requestOf(fetchFn: ReturnType<typeof vi.fn<typeof fetch>>, call = 0) {
  const [url, init] = fetchFn.mock.calls[call] ?? []
  const headers = new Headers(init?.headers)
  return { url, body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined, headers, init }
}

describe('createHttpAuthProvider', () => {
  it('signs in, keeps the token in memory and sends the refresh cookie along', async () => {
    const { auth, fetchFn } = setup([json(200, sessionBody())])

    expect(await auth.signIn('ana@exemplo.edu.br', 'senha-forte-1')).toEqual(USER)
    expect(auth.getCurrentUser()).toEqual(USER)
    expect(await auth.getAccessToken()).toBe('token-1')

    const { url, body, init } = requestOf(fetchFn)
    expect(url).toBe('/api/auth/login')
    expect(body).toEqual({ email: 'ana@exemplo.edu.br', password: 'senha-forte-1' })
    expect(init?.credentials).toBe('same-origin')
  })

  it('signs up with the name, e-mail and password only', async () => {
    const { auth, fetchFn } = setup([json(201, sessionBody())])

    await auth.signUp('Ana Lima', 'ana@exemplo.edu.br', 'senha-forte-1')

    expect(requestOf(fetchFn).url).toBe('/api/auth/register')
    expect(requestOf(fetchFn).body).toEqual({ fullName: 'Ana Lima', email: 'ana@exemplo.edu.br', password: 'senha-forte-1' })
  })

  it("passes on the API's message when sign-in is refused", async () => {
    const { auth } = setup([json(401, { code: 'unauthorized', message: 'E-mail ou senha incorretos.' })])

    await expect(auth.signIn('ana@exemplo.edu.br', 'errada')).rejects.toMatchObject({
      code: 'unauthorized',
      message: 'E-mail ou senha incorretos.',
    })
    expect(auth.getCurrentUser()).toBeNull()
  })

  it('has no token without a session, and does not ask the API for one', async () => {
    const { auth, fetchFn } = setup([])

    expect(await auth.getAccessToken()).toBeNull()
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('restores the session from the cookie when the app opens', async () => {
    const { auth, fetchFn } = setup([json(200, sessionBody('restaurado'))])

    expect(await auth.restoreSession()).toEqual(USER)
    expect(requestOf(fetchFn).url).toBe('/api/auth/refresh')
    expect(await auth.getAccessToken()).toBe('restaurado')
  })

  it('answers no one when the cookie is refused, without failing', async () => {
    const { auth } = setup([json(401, { code: 'unauthorized', message: 'Sua sessão terminou. Entre de novo.' })])

    expect(await auth.restoreSession()).toBeNull()
  })

  it('does not ask again once the session is known', async () => {
    const { auth, fetchFn } = setup([json(200, sessionBody())])
    await auth.signIn('ana@exemplo.edu.br', 'senha-forte-1')

    expect(await auth.restoreSession()).toEqual(USER)
    expect(fetchFn).toHaveBeenCalledOnce()
  })

  it('renews the token shortly before it expires, never with it already dead', async () => {
    const { auth, fetchFn, advance } = setup([json(200, sessionBody('primeiro')), json(200, sessionBody('renovado'))])
    await auth.signIn('ana@exemplo.edu.br', 'senha-forte-1')

    advance(860_000)
    expect(await auth.getAccessToken()).toBe('primeiro')
    advance(20_000)
    expect(await auth.getAccessToken()).toBe('renovado')
    expect(requestOf(fetchFn, 1).url).toBe('/api/auth/refresh')
  })

  it('makes one refresh for everyone who asks at the same time', async () => {
    const { auth, fetchFn } = setup([json(200, sessionBody())])

    const [first, second] = await Promise.all([auth.restoreSession(), auth.restoreSession()])

    expect(first).toEqual(USER)
    expect(second).toEqual(USER)
    expect(fetchFn).toHaveBeenCalledOnce()
  })

  it('refreshes under the lock shared by the tabs of the browser', async () => {
    const request = vi.fn((_name: string, callback: () => Promise<unknown>) => callback())
    const { auth } = setup([json(200, sessionBody())], { locks: { request } as unknown as LockManager })

    await auth.restoreSession()

    expect(request).toHaveBeenCalledWith('correctio:refresh', expect.any(Function))
  })

  it('ends the session when the API refuses the renewal', async () => {
    const { auth, advance } = setup([
      json(200, sessionBody()),
      json(401, { code: 'unauthorized', message: 'Sua sessão terminou. Entre de novo.' }),
    ])
    await auth.signIn('ana@exemplo.edu.br', 'senha-forte-1')

    advance(900_000)

    expect(await auth.getAccessToken()).toBeNull()
    expect(auth.getCurrentUser()).toBeNull()
  })

  it('reports a server that cannot be reached as a failure, not as a signed-out session', async () => {
    const { auth, fetchFn } = setup([])
    fetchFn.mockRejectedValueOnce(new TypeError('offline'))

    await expect(auth.restoreSession()).rejects.toMatchObject({ code: 'failure' })
  })

  it('refuses an answer that is not a session', async () => {
    const { auth } = setup([json(200, { accessToken: 'x' })])

    await expect(auth.signIn('ana@exemplo.edu.br', 'senha-forte-1')).rejects.toBeInstanceOf(StorageError)
  })

  it('forgets the session on sign-out even when the API cannot be reached', async () => {
    const { auth, fetchFn } = setup([json(200, sessionBody())])
    await auth.signIn('ana@exemplo.edu.br', 'senha-forte-1')
    fetchFn.mockRejectedValueOnce(new TypeError('offline'))

    await expect(auth.signOut()).rejects.toMatchObject({ code: 'failure' })
    expect(auth.getCurrentUser()).toBeNull()
    expect(requestOf(fetchFn, 1).url).toBe('/api/auth/logout')
  })

  it('ends every session with the access token, since the API must know whose', async () => {
    const { auth, fetchFn } = setup([json(200, sessionBody('token-ana')), json(204)])
    await auth.signIn('ana@exemplo.edu.br', 'senha-forte-1')

    await auth.signOutEverywhere()

    const { url, headers } = requestOf(fetchFn, 1)
    expect(url).toBe('/api/auth/logout-all')
    expect(headers.get('Authorization')).toBe('Bearer token-ana')
    expect(auth.getCurrentUser()).toBeNull()
  })

  it('asks for the reset link and sets the new password from the code', async () => {
    const { auth, fetchFn } = setup([json(204), json(204)])

    await auth.requestPasswordReset('ana@exemplo.edu.br')
    await auth.resetPassword('codigo', 'senha-nova-1')

    expect(requestOf(fetchFn, 0)).toMatchObject({ url: '/api/auth/forgot-password', body: { email: 'ana@exemplo.edu.br' } })
    expect(requestOf(fetchFn, 1)).toMatchObject({ url: '/api/auth/reset-password', body: { code: 'codigo', password: 'senha-nova-1' } })
  })

  describe('Google', () => {
    it('leaves for Google keeping the secret in the tab and sending only its hash', async () => {
      const { auth, navigate, tabStorage } = setup([])

      await auth.startGoogleSignIn()

      const secret = tabStorage.values.get('correctio:google-binding') ?? ''
      const url = new URL(navigate.mock.calls[0]?.[0] ?? '', 'https://correctio-app.web.app')
      expect(url.pathname).toBe('/api/auth/google')
      expect(url.searchParams.get('returnTo')).toBe('https://correctio-app.web.app')
      expect(url.searchParams.get('binding')).toMatch(/^[0-9a-f]{64}$/)
      expect(url.searchParams.get('binding')).not.toBe(secret)
      expect(secret).toMatch(/^[0-9a-f]{64}$/)
    })

    it('exchanges the code with the secret of this tab, once', async () => {
      const { auth, fetchFn, tabStorage } = setup([json(200, sessionBody())])
      tabStorage.setItem('correctio:google-binding', 'segredo')

      expect(await auth.completeGoogleSignIn('codigo')).toEqual(USER)
      expect(requestOf(fetchFn)).toMatchObject({ url: '/api/auth/google/exchange', body: { code: 'codigo', binding: 'segredo' } })
      expect(tabStorage.values.has('correctio:google-binding')).toBe(false)
    })

    it('refuses a code that arrives in a tab that never started the sign-in', async () => {
      const { auth, fetchFn } = setup([])

      await expect(auth.completeGoogleSignIn('codigo')).rejects.toMatchObject({ code: 'unauthorized' })
      expect(fetchFn).not.toHaveBeenCalled()
    })
  })

  it('says anonymizing is not available yet instead of pretending', async () => {
    const { auth } = setup([])

    await expect(auth.anonymize()).rejects.toMatchObject({ code: 'failure' })
  })
})
