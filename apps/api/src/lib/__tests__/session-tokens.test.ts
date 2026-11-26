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

describe('second-factor challenge', () => {
  it('reads back the account of a challenge it signed', async () => {
    expect(await tokens.verifySecondFactorChallenge(await tokens.signSecondFactorChallenge('ana', 60))).toBe('ana')
  })

  it('is not an access token or a Google state, and neither of them is a challenge', async () => {
    const challenge = await tokens.signSecondFactorChallenge('ana', 60)
    const access = await tokens.signAccessToken({ userId: 'ana', role: 'professor' })
    const state = await tokens.signState({ returnTo: 'https://correctio-app.web.app' }, 60)

    expect(await tokens.verifyAccessToken(challenge)).toBeNull()
    expect(await tokens.verifyState(challenge)).toBeNull()
    expect(await tokens.verifySecondFactorChallenge(access)).toBeNull()
    expect(await tokens.verifySecondFactorChallenge(state)).toBeNull()
  })

  it('refuses an expired challenge, one signed with another secret and anything that is not a token', async () => {
    const other = createSessionTokens(Buffer.alloc(32, 4).toString('base64'))

    expect(await tokens.verifySecondFactorChallenge(await tokens.signSecondFactorChallenge('ana', -60))).toBeNull()
    expect(await tokens.verifySecondFactorChallenge(await other.signSecondFactorChallenge('ana', 60))).toBeNull()
    expect(await tokens.verifySecondFactorChallenge('nem-um-jwt')).toBeNull()
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
