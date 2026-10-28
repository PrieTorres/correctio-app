import { describe, expect, it, vi } from 'vitest'
import { StorageError } from '@/lib/storage/errors'
import { createApiClient, toQueryString, toStorageError } from '../api-client'

function respondWith(status: number, body?: unknown) {
  return vi.fn<typeof fetch>(() =>
    Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status })),
  )
}

function clientWith(fetchFn: typeof fetch, token: string | null = 'token-ana') {
  const onUnauthorized = vi.fn()
  const api = createApiClient({ baseUrl: '/api', getToken: () => Promise.resolve(token), onUnauthorized, fetchFn })
  return { api, onUnauthorized }
}

function requestOf(fetchFn: ReturnType<typeof respondWith>): { url: string; init: RequestInit } {
  const call = fetchFn.mock.calls[0]
  if (call === undefined) throw new Error('fetch was not called')
  const [input, init = {}] = call
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  return { url, init }
}

async function failureOf(promise: Promise<unknown>): Promise<StorageError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof StorageError) return error
  }
  throw new Error('expected a StorageError')
}

describe('toQueryString', () => {
  it('turns list params into a query string, repeating a list and skipping what is unset', () => {
    expect(toQueryString({ search: 'cálculo', archived: false, page: 2, tags: ['a', 'b'], type: undefined })).toBe(
      '?search=c%C3%A1lculo&archived=false&page=2&tags=a&tags=b',
    )
  })

  it('adds nothing when there is nothing to send', () => {
    expect(toQueryString({ search: undefined })).toBe('')
  })
})

describe('createApiClient', () => {
  it('calls the API path with the query string and returns the body', async () => {
    const fetchFn = respondWith(200, { items: [], total: 0 })
    const { api } = clientWith(fetchFn)

    await expect(api.request('GET', '/classes', { query: { page: 1 } })).resolves.toEqual({ items: [], total: 0 })
    expect(requestOf(fetchFn).url).toBe('/api/classes?page=1')
  })

  it('sends the token only in the Authorization header, never in the URL', async () => {
    const fetchFn = respondWith(200, {})
    await clientWith(fetchFn).api.request('GET', '/classes')

    const { url, init } = requestOf(fetchFn)
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token-ana')
    expect(url).not.toContain('token-ana')
  })

  it('sends no Authorization header without a session', async () => {
    const fetchFn = respondWith(200, {})
    await clientWith(fetchFn, null).api.request('GET', '/classes')

    expect(new Headers(requestOf(fetchFn).init.headers).has('Authorization')).toBe(false)
  })

  it('sends a body as JSON', async () => {
    const fetchFn = respondWith(201, { id: 'c1' })
    await clientWith(fetchFn).api.request('POST', '/classes', { body: { name: 'Cálculo I' } })

    const { init } = requestOf(fetchFn)
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json')
    expect(init.body).toBe('{"name":"Cálculo I"}')
  })

  it('reads an empty answer as nothing', async () => {
    await expect(clientWith(respondWith(204)).api.request('PATCH', '/classes/c1/archive')).resolves.toBeUndefined()
  })

  it('turns a 401 into "unauthorized" and tells the app, so it can drop the cache', async () => {
    const { api, onUnauthorized } = clientWith(respondWith(401, { code: 'unauthorized', message: 'Faça login para continuar.' }))
    const error = await failureOf(api.request('GET', '/classes'))

    expect(error.code).toBe('unauthorized')
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('turns a network failure into a generic failure', async () => {
    const fetchFn = vi.fn<typeof fetch>(() => Promise.reject(new TypeError('Failed to fetch')))
    const error = await failureOf(clientWith(fetchFn).api.request('GET', '/classes'))

    expect(error.code).toBe('failure')
    expect(error.message).toBe('Não foi possível falar com o servidor. Tente de novo em instantes.')
  })
})

describe('toStorageError', () => {
  it.each([
    [400, 'invalid'],
    [404, 'not-found'],
    [409, 'conflict'],
  ] as const)('keeps the message of a %i and maps it to "%s"', (status, code) => {
    const error = toStorageError(status, { code, message: 'Já existe uma turma com estes dados.' })

    expect(error.code).toBe(code)
    expect(error.message).toBe('Já existe uma turma com estes dados.')
  })

  it('shows the server message of a 429 as a failure', () => {
    const error = toStorageError(429, { code: 'too-many-requests', message: 'Muitas requisições. Espere um minuto.' })

    expect(error.code).toBe('failure')
    expect(error.message).toBe('Muitas requisições. Espere um minuto.')
  })

  it('hides a server error behind a generic message', () => {
    const error = toStorageError(500, { code: 'failure', message: 'Erro inesperado.' })

    expect(error.code).toBe('failure')
    expect(error.message).toBe('Não foi possível falar com o servidor. Tente de novo em instantes.')
  })

  it('treats an error body out of shape as a failure', () => {
    expect(toStorageError(400, '<html>Bad Request</html>').code).toBe('failure')
  })

  it('asks for the sign-in on a 401 even without a body', () => {
    expect(toStorageError(401, undefined).message).toBe('Faça login para continuar.')
  })
})

describe('download', () => {
  /** What Express sends for `res.attachment(...).send(buffer)`. */
  function respondWithFile(headers: Record<string, string>) {
    return vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response('%PDF-1.7', { status: 200, headers: { 'Content-Type': 'application/pdf', ...headers } })),
    )
  }

  it('answers the file and the name the API gave it, asking with the token', async () => {
    const fetchFn = respondWithFile({ 'Content-Disposition': 'attachment; filename=prova-2026-10-05.pdf' })

    const file = await clientWith(fetchFn).api.download('/applications/a1/pdf')

    expect(file.filename).toBe('prova-2026-10-05.pdf')
    expect(await file.blob.text()).toBe('%PDF-1.7')
    const { url, init } = requestOf(fetchFn)
    expect([url, init.method]).toEqual(['/api/applications/a1/pdf', 'GET'])
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token-ana')
  })

  it('reads a quoted name too, as a name with spaces arrives', async () => {
    const fetchFn = respondWithFile({ 'Content-Disposition': 'attachment; filename="prova de cálculo.pdf"' })

    expect((await clientWith(fetchFn).api.download('/applications/a1/pdf')).filename).toBe('prova de cálculo.pdf')
  })

  it('leaves the name out when the response does not give one', async () => {
    const file = await clientWith(respondWithFile({})).api.download('/applications/a1/pdf')

    expect(file.filename).toBeUndefined()
  })

  it('turns a refusal into the error the screens show, with the message of the API', async () => {
    const fetchFn = respondWith(404, { code: 'not-found', message: 'O PDF desta aplicação ainda não foi gerado.' })

    const error = await failureOf(clientWith(fetchFn).api.download('/applications/a1/pdf'))

    expect([error.code, error.message]).toEqual(['not-found', 'O PDF desta aplicação ainda não foi gerado.'])
  })

  it('tells the app when the session ended', async () => {
    const { api, onUnauthorized } = clientWith(respondWith(401, { code: 'unauthorized', message: 'Sessão expirada.' }))

    await failureOf(api.download('/applications/a1/pdf'))

    expect(onUnauthorized).toHaveBeenCalledOnce()
  })
})
