import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type GenerateKeyPairResult, type JWK } from 'jose'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createGoogleIdentity, type GoogleIdentityOptions } from '../google-identity'

const CLIENT = { clientId: 'cliente.apps.googleusercontent.com', clientSecret: 'segredo', redirectUri: 'https://correctio-app.web.app/api/auth/google/callback' }

let privateKey: GenerateKeyPairResult['privateKey']
let publicJwk: JWK

beforeAll(async () => {
  const pair = await generateKeyPair('RS256')
  privateKey = pair.privateKey
  publicJwk = { ...(await exportJWK(pair.publicKey)), kid: 'chave-teste', alg: 'RS256' }
})

/** An ID token as Google would sign it, with the claims the test chooses. */
function idToken(claims: Record<string, unknown>, audience = CLIENT.clientId) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'chave-teste' })
    .setIssuer('https://accounts.google.com')
    .setAudience(audience)
    .setExpirationTime('5m')
    .sign(privateKey)
}

function identityAnswering(response: Response, options: Partial<GoogleIdentityOptions> = {}) {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response)
  const identity = createGoogleIdentity({ ...CLIENT, keys: createLocalJWKSet({ keys: [publicJwk] }), fetch, ...options })
  return { identity, fetch }
}

describe('createGoogleIdentity', () => {
  it('sends the person to Google with the fixed return address and the state', () => {
    const { identity } = identityAnswering(new Response())
    const url = new URL(identity.authorizationUrl('estado-assinado'))

    expect(`${url.origin}${url.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: CLIENT.clientId,
      redirect_uri: CLIENT.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: 'estado-assinado',
    })
  })

  it('trades the code with the client secret and reads a verified e-mail and name', async () => {
    const token = await idToken({ email: 'bia@gmail.com', email_verified: true, name: 'Bia Souza' })
    const { identity, fetch } = identityAnswering(Response.json({ id_token: token }))

    expect(await identity.identify('codigo')).toEqual({ email: 'bia@gmail.com', fullName: 'Bia Souza' })
    const body = fetch.mock.calls[0]?.[1]?.body
    expect(body instanceof URLSearchParams ? Object.fromEntries(body) : {}).toMatchObject({
      code: 'codigo',
      client_secret: 'segredo',
      grant_type: 'authorization_code',
    })
  })

  it('names the account after the address when Google sends no name', async () => {
    const token = await idToken({ email: 'bia@gmail.com', email_verified: true })
    const { identity } = identityAnswering(Response.json({ id_token: token }))

    expect(await identity.identify('codigo')).toEqual({ email: 'bia@gmail.com', fullName: 'bia' })
  })

  it('refuses an address Google did not verify', async () => {
    const token = await idToken({ email: 'bia@gmail.com', email_verified: false })
    const { identity } = identityAnswering(Response.json({ id_token: token }))

    expect(await identity.identify('codigo')).toBeNull()
  })

  it('refuses when Google refuses the code or answers without an ID token', async () => {
    expect(await identityAnswering(new Response('{}', { status: 400 })).identity.identify('codigo')).toBeNull()
    expect(await identityAnswering(Response.json({ access_token: 'x' })).identity.identify('codigo')).toBeNull()
  })

  it('rejects an ID token issued to another client', async () => {
    const token = await idToken({ email: 'bia@gmail.com', email_verified: true }, 'outro-cliente')

    await expect(identityAnswering(Response.json({ id_token: token })).identity.identify('codigo')).rejects.toThrow()
  })
})
