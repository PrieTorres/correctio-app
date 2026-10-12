import { describe, expect, it } from 'vitest'
import { loadEnv } from '../env'

const LOCAL_DATABASE = 'mysql://app@127.0.0.1:3307/correctio'
const KEY = Buffer.alloc(32, 7).toString('base64')

describe('loadEnv', () => {
  it('starts with safe local defaults', () => {
    expect(loadEnv({ DATABASE_URL: LOCAL_DATABASE })).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      CORS_ORIGINS: ['http://localhost:5173', 'http://localhost:4173'],
      LOG_LEVEL: 'info',
      TRUST_PROXY_HOPS: 1,
      DATABASE_URL: LOCAL_DATABASE,
      DATABASE_TLS: 'verify',
      DATABASE_CA_CERT: undefined,
      DATA_ENCRYPTION_KEY: undefined,
    })
  })

  it('reads a list of origins separated by commas', () => {
    const env = loadEnv({ NODE_ENV: 'test', CORS_ORIGINS: ' https://correctio-app.web.app , http://localhost:5173 ' })

    expect(env.CORS_ORIGINS).toEqual(['https://correctio-app.web.app', 'http://localhost:5173'])
  })

  it('refuses an origin with a path, which a browser would never send', () => {
    expect(() => loadEnv({ NODE_ENV: 'test', CORS_ORIGINS: 'https://correctio-app.web.app/turmas/' })).toThrow(
      /CORS_ORIGINS/,
    )
  })

  it('names the variable that is wrong', () => {
    expect(() => loadEnv({ NODE_ENV: 'test', PORT: 'not-a-port' })).toThrow(/PORT/)
  })

  it('cannot be changed after it is read', () => {
    expect(Object.isFrozen(loadEnv({ NODE_ENV: 'test' }))).toBe(true)
  })

  it('requires a database outside the tests', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/)
    expect(() => loadEnv({ DATABASE_URL: 'postgres://elsewhere/db' })).toThrow(/DATABASE_URL/)
  })

  it('treats an empty line in .env as not set', () => {
    expect(loadEnv({ NODE_ENV: 'test', DATABASE_CA_CERT: '  ', DATA_ENCRYPTION_KEY: '' })).toMatchObject({
      DATABASE_CA_CERT: undefined,
      DATA_ENCRYPTION_KEY: undefined,
    })
  })

  it('refuses an encryption key that is not 32 bytes', () => {
    expect(() => loadEnv({ NODE_ENV: 'test', DATA_ENCRYPTION_KEY: Buffer.alloc(16).toString('base64') })).toThrow(
      /DATA_ENCRYPTION_KEY/,
    )
  })

  describe('in production', () => {
    const production = {
      NODE_ENV: 'production',
      DATABASE_URL: LOCAL_DATABASE,
      DATABASE_TLS: 'verify',
      DATABASE_CA_CERT: '-----BEGIN CERTIFICATE-----\\nabc\\n-----END CERTIFICATE-----',
      DATA_ENCRYPTION_KEY: KEY,
    }

    it('accepts a verified database connection with its certificate and an encryption key', () => {
      expect(loadEnv(production).NODE_ENV).toBe('production')
    })

    it('refuses to skip the certificate check or to run without the certificate', () => {
      expect(() => loadEnv({ ...production, DATABASE_TLS: 'local' })).toThrow(/DATABASE_TLS/)
      expect(() => loadEnv({ ...production, DATABASE_CA_CERT: undefined })).toThrow(/DATABASE_TLS/)
    })

    it('refuses to run without the encryption key', () => {
      expect(() => loadEnv({ ...production, DATA_ENCRYPTION_KEY: undefined })).toThrow(/DATA_ENCRYPTION_KEY/)
    })
  })
})
