import { SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import { createOpaqueToken, createSessionTokens, hashOpaqueToken } from '../session-tokens'

const SECRET = Buffer.alloc(32, 3).toString('base64')
const tokens = createSessionTokens(SECRET)

describe('createSessionTokens', () => {
  it('reads back the teacher and role of an access token it signed', async () => {
    const token = await tokens.signAccessToken({ userId: 'ana', role: 'professor' })

    expect(await tokens.verifyAccessToken(token)).toEqual({ userId: 'ana', role: 'professor' })
  })

  it('refuses a token signed with another secret', async () => {
    const other = createSessionTokens(Buffer.alloc(32, 4).toString('base64'))
    const token = await other.signAccessToken({ userId: 'ana', role: 'professor' })

    expect(await tokens.verifyAccessToken(token)).toBeNull()
  })

  it('refuses an expired token and anything that is not a token', async () => {
    const expired = await new SignJWT({ role: 'professor' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('ana')
      .setIssuer('correctio')
      .setAudience('correctio-api')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(Buffer.from(SECRET, 'base64'))

    expect(await tokens.verifyAccessToken(expired)).toBeNull()
    expect(await tokens.verifyAccessToken('nem-um-jwt')).toBeNull()
  })

  it('does not accept the Google state as an access token, nor the other way round', async () => {
    const state = await tokens.signState({ returnTo: 'https://correctio-app.web.app' }, 60)
    const access = await tokens.signAccessToken({ userId: 'ana', role: 'professor' })

    expect(await tokens.verifyAccessToken(state)).toBeNull()
    expect(await tokens.verifyState(access)).toBeNull()
    expect(await tokens.verifyState(state)).toMatchObject({ returnTo: 'https://correctio-app.web.app' })
  })
})

describe('opaque tokens', () => {
  it('are random and stored as a SHA-256 that does not reveal them', () => {
    const token = createOpaqueToken()

    expect(token).not.toBe(createOpaqueToken())
    expect(token).toMatch(/^[\w-]{43}$/)
    expect(hashOpaqueToken(token)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashOpaqueToken(token)).not.toContain(token)
  })
})
