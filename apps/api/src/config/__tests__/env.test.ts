import { describe, expect, it } from 'vitest'
import { loadEnv } from '../env'

describe('loadEnv', () => {
  it('starts with safe local defaults', () => {
    expect(loadEnv({})).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      CORS_ORIGINS: ['http://localhost:5173', 'http://localhost:4173'],
      LOG_LEVEL: 'info',
      TRUST_PROXY_HOPS: 1,
    })
  })

  it('reads a list of origins separated by commas', () => {
    const env = loadEnv({ CORS_ORIGINS: ' https://prietorres.github.io , http://localhost:5173 ' })

    expect(env.CORS_ORIGINS).toEqual(['https://prietorres.github.io', 'http://localhost:5173'])
  })

  it('refuses an origin with a path, which a browser would never send', () => {
    expect(() => loadEnv({ CORS_ORIGINS: 'https://prietorres.github.io/correctio-app/' })).toThrow(/CORS_ORIGINS/)
  })

  it('names the variable that is wrong', () => {
    expect(() => loadEnv({ PORT: 'not-a-port' })).toThrow(/PORT/)
  })

  it('cannot be changed after it is read', () => {
    expect(Object.isFrozen(loadEnv({}))).toBe(true)
  })
})
