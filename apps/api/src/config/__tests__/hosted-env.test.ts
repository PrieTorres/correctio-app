import { describe, expect, it } from 'vitest'
import { loadEnv } from '../env'
import { hostedEnvSource } from '../hosted-env'

const SECRETS = {
  DATABASE_URL: 'mysql://app@db.example:3306/correctio',
  DATABASE_CA_CERT: '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----',
  DATA_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
}

describe('hostedEnvSource', () => {
  it('runs in production, verifying the database certificate', () => {
    const env = loadEnv(hostedEnvSource({ GCLOUD_PROJECT: 'correctio-app', ...SECRETS }))

    expect(env.NODE_ENV).toBe('production')
    expect(env.DATABASE_TLS).toBe('verify')
    expect(env.DATABASE_URL).toBe(SECRETS.DATABASE_URL)
  })

  it('accepts only the addresses of the project it runs in', () => {
    const env = loadEnv(hostedEnvSource({ GCLOUD_PROJECT: 'correctio-app-preview', ...SECRETS }))

    expect(env.CORS_ORIGINS).toEqual([
      'https://correctio-app-preview.web.app',
      'https://correctio-app-preview.firebaseapp.com',
    ])
  })

  it('reads the client address behind the two proxies of Firebase Hosting', () => {
    const env = loadEnv(hostedEnvSource({ GCLOUD_PROJECT: 'correctio-app', ...SECRETS }))

    expect(env.TRUST_PROXY_HOPS).toBe(2)
  })

  it('cannot be turned into development or a connection without the certificate check', () => {
    const source = hostedEnvSource({ GCLOUD_PROJECT: 'correctio-app', NODE_ENV: 'development', DATABASE_TLS: 'local' })

    expect(source.NODE_ENV).toBe('production')
    expect(source.DATABASE_TLS).toBe('verify')
  })

  it('refuses to start without the secrets production requires', () => {
    expect(() => loadEnv(hostedEnvSource({ GCLOUD_PROJECT: 'correctio-app' }))).toThrow(/DATA_ENCRYPTION_KEY/)
  })

  it('refuses to run outside Firebase', () => {
    expect(() => hostedEnvSource(SECRETS)).toThrow(/GCLOUD_PROJECT/)
  })
})
