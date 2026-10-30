import { StorageError, type StorageErrorCode } from '@/lib/storage/errors'

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export type QueryValue = string | number | boolean | readonly string[] | undefined

export type QueryParams = Readonly<Record<string, QueryValue>>

export interface RequestOptions {
  query?: QueryParams
  body?: unknown
}

/**
 * The only way the web app reaches the API. It answers `unknown`: the response
 * is external data, and each repository validates it with the entity schema.
 */
export interface ApiClient {
  request: (method: HttpMethod, path: string, options?: RequestOptions) => Promise<unknown>
}

export interface ApiClientOptions {
  /** From `apiBaseUrl()`, already without the trailing slash. */
  baseUrl: string
  /**
   * The session's access token, or `null` without one. It lives in memory and
   * travels only in the `Authorization` header, never in the URL, where it
   * would end up in history, proxy logs and the `Referer` header.
   */
  getToken: () => Promise<string | null>
  /**
   * Called on every 401 before the error reaches the screen: the app drops its
   * cache there, and #40 decides between refreshing the token and the sign-in.
   */
  onUnauthorized: () => void
  /** Swapped in tests; the browser's `fetch` otherwise. */
  fetchFn?: typeof fetch
}

const GENERIC_FAILURE = 'Não foi possível falar com o servidor. Tente de novo em instantes.'
const WAIT_A_MINUTE = 'Muitas consultas seguidas. Aguarde um minuto e tente de novo.'
const SIGN_IN_REQUIRED = 'Faça login para continuar.'

/** The client errors the API answers in its `{ code, message }` shape, mapped by status. */
const CLIENT_ERRORS: Readonly<Partial<Record<number, StorageErrorCode>>> = {
  400: 'invalid',
  404: 'not-found',
  409: 'conflict',
}

/**
 * 429 has its own code because the right reaction differs from every other
 * failure: reloading, which the generic message asks for, only spends more of
 * the budget that ran out.
 */
const TOO_MANY_REQUESTS = 429

interface ErrorBody {
  code: string
  message: string
}

function isErrorBody(body: unknown): body is ErrorBody {
  if (typeof body !== 'object' || body === null) return false
  return 'code' in body && typeof body.code === 'string' && 'message' in body && typeof body.message === 'string'
}

/**
 * Turns a failed response into the one error the screens already handle.
 * The server's message is kept when it sent one in the expected shape, because
 * `SaveError` shows the text as it came; anything else becomes a generic
 * failure, without a stack trace or server detail.
 */
export function toStorageError(status: number, body: unknown): StorageError {
  const server = isErrorBody(body) ? body : null
  if (status === 401) return new StorageError(server?.message ?? SIGN_IN_REQUIRED, 'unauthorized')

  const clientCode = CLIENT_ERRORS[status]
  if (server !== null && clientCode !== undefined) return new StorageError(server.message, clientCode)
  if (status === TOO_MANY_REQUESTS) return new StorageError(server?.message ?? WAIT_A_MINUTE, 'rate-limited')

  return new StorageError(GENERIC_FAILURE, 'failure')
}

function queryEntries(name: string, value: QueryValue): [string, string][] {
  if (value === undefined) return []
  if (Array.isArray(value)) return value.map((item: string) => [name, item])
  return [[name, String(value)]]
}

/**
 * `ListParams` and the entity filters as a query string. A list repeats its key
 * (`tags=a&tags=b`), which is how the API reads several values of one filter.
 */
export function toQueryString(query: QueryParams = {}): string {
  const params = new URLSearchParams(Object.entries(query).flatMap(([name, value]) => queryEntries(name, value)))
  const encoded = params.toString()
  return encoded === '' ? '' : `?${encoded}`
}

async function requestHeaders(getToken: () => Promise<string | null>, hasBody: boolean): Promise<Headers> {
  const headers = new Headers({ Accept: 'application/json' })
  if (hasBody) headers.set('Content-Type', 'application/json')

  const token = await getToken()
  if (token !== null) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

/** A body that is not JSON reads as nothing, which validation then refuses. */
async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

export function createApiClient({
  baseUrl,
  getToken,
  onUnauthorized,
  fetchFn = (input, init) => fetch(input, init),
}: ApiClientOptions): ApiClient {
  return {
    async request(method, path, { query, body } = {}) {
      const headers = await requestHeaders(getToken, body !== undefined)

      let response: Response
      try {
        response = await fetchFn(`${baseUrl}${path}${toQueryString(query)}`, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
        })
      } catch (cause) {
        throw new StorageError(GENERIC_FAILURE, 'failure', { cause })
      }

      const payload = await readJson(response)
      if (response.ok) return payload

      if (response.status === 401) onUnauthorized()
      throw toStorageError(response.status, payload)
    },
  }
}
