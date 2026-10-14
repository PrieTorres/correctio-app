import { describe, expect, it } from 'vitest'
import { apiBaseUrl } from '../api-config'

describe('apiBaseUrl', () => {
  it('calls the same origin when nothing is configured', () => {
    expect(apiBaseUrl({})).toBe('/api')
    expect(apiBaseUrl({ VITE_API_URL: '  ' })).toBe('/api')
  })

  it('uses the configured address without the trailing slash', () => {
    expect(apiBaseUrl({ VITE_API_URL: 'http://localhost:3000/' })).toBe('http://localhost:3000')
  })
})
