import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { createLogger } from '../logger'
import { acceptAnyPassword, createPwnedPasswordChecker } from '../pwned-passwords'

const PASSWORD = 'correct horse battery staple'
const SHA1 = createHash('sha1').update(PASSWORD).digest('hex').toUpperCase()
const PREFIX = SHA1.slice(0, 5)
const SUFFIX = SHA1.slice(5)

function build(respond: (url: string, init: RequestInit | undefined) => Promise<Response>) {
  const warn = vi.fn()
  const logger = Object.assign(createLogger('silent'), { warn })
  const fetchFn = vi.fn((input: string | URL | Request, init?: RequestInit) => respond(input instanceof Request ? input.url : input.toString(), init))
  const checker = createPwnedPasswordChecker({ logger, fetchFn, timeoutMs: 50, baseUrl: 'https://pwned.test/range' })
  return { checker, fetchFn, warn }
}

const text = (body: string, status = 200) => Promise.resolve(new Response(body, { status }))

describe('createPwnedPasswordChecker', () => {
  it('sends only the first five characters of the hash, with padding requested', async () => {
    const { checker, fetchFn } = build(() => text(''))
    await checker.isBreached(PASSWORD)

    const [url, init] = fetchFn.mock.calls[0] ?? []
    expect(url).toBe(`https://pwned.test/range/${PREFIX}`)
    expect(url).not.toContain(SUFFIX)
    expect(new Headers(init?.headers).get('Add-Padding')).toBe('true')
  })

  it('reports a password whose suffix is in the answer with a count above zero', async () => {
    const { checker } = build(() => text(`0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n${SUFFIX}:3861\r\n`))
    await expect(checker.isBreached(PASSWORD)).resolves.toBe(true)
  })

  it('ignores the padding lines, which carry a count of zero', async () => {
    const { checker } = build(() => text(`${SUFFIX}:0\r\n`))
    await expect(checker.isBreached(PASSWORD)).resolves.toBe(false)
  })

  it('accepts a password whose suffix is not in the answer', async () => {
    const { checker, warn } = build(() => text('0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n'))
    await expect(checker.isBreached(PASSWORD)).resolves.toBe(false)
    expect(warn).not.toHaveBeenCalled()
  })

  it('fails open on a network error and logs the reason without the password or its hash', async () => {
    const { checker, warn } = build(() => Promise.reject(new TypeError('fetch failed')))
    await expect(checker.isBreached(PASSWORD)).resolves.toBe(false)

    const logged = JSON.stringify(warn.mock.calls)
    expect(warn).toHaveBeenCalledOnce()
    expect(logged).not.toContain(PASSWORD)
    expect(logged).not.toContain(SUFFIX)
    expect(logged).not.toContain(PREFIX)
  })

  it('fails open on an error status', async () => {
    const { checker, warn } = build(() => text('', 503))
    await expect(checker.isBreached(PASSWORD)).resolves.toBe(false)
    expect(warn).toHaveBeenCalledOnce()
  })

  it('fails open when the answer takes longer than the timeout', async () => {
    const { checker, warn } = build(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        }),
    )
    await expect(checker.isBreached(PASSWORD)).resolves.toBe(false)
    expect(warn).toHaveBeenCalledOnce()
  })
})

describe('acceptAnyPassword', () => {
  it('never reports a breach', async () => {
    await expect(acceptAnyPassword.isBreached(PASSWORD)).resolves.toBe(false)
  })
})
