import { describe, expect, it } from 'vitest'
import { isAllowedReturnOrigin } from '../google-sign-in-service'

const PRODUCTION = { publicAppUrl: 'https://correctio-app.web.app', corsOrigins: ['https://correctio-app.web.app', 'https://correctio-app.firebaseapp.com'] }
const LOCAL = { publicAppUrl: 'http://localhost:5173', corsOrigins: ['http://localhost:5173', 'http://localhost:4173'] }

describe('isAllowedReturnOrigin', () => {
  it('accepts the addresses of the environment itself', () => {
    expect(isAllowedReturnOrigin('https://correctio-app.web.app', PRODUCTION)).toBe(true)
    expect(isAllowedReturnOrigin('https://correctio-app.firebaseapp.com', PRODUCTION)).toBe(true)
    expect(isAllowedReturnOrigin('http://localhost:4173', LOCAL)).toBe(true)
  })

  it('accepts a preview link of the same site', () => {
    expect(isAllowedReturnOrigin('https://correctio-app--feat-login-ab12cd34.web.app', PRODUCTION)).toBe(true)
  })

  it('refuses another site, a look-alike and a preview of another project', () => {
    expect(isAllowedReturnOrigin('https://atacante.example', PRODUCTION)).toBe(false)
    expect(isAllowedReturnOrigin('https://correctio-app.web.app.atacante.example', PRODUCTION)).toBe(false)
    expect(isAllowedReturnOrigin('https://outro--correctio-app.web.app', PRODUCTION)).toBe(false)
    expect(isAllowedReturnOrigin('https://correctio-app--canal.web.app/caminho', PRODUCTION)).toBe(false)
  })

  it('has no preview links where the site is not on Firebase', () => {
    expect(isAllowedReturnOrigin('https://localhost--canal.web.app', LOCAL)).toBe(false)
  })
})
