import { describe, expect, it } from 'vitest'
import { createHealthService } from '../../services/health-service'
import { pingDatabase } from '../../repositories/database-health-repository'
import { createDatabase, tlsOptions } from '../connection'

describe('tlsOptions', () => {
  it('verifies the hosted database against its certificate', () => {
    const options = tlsOptions({ tls: 'verify', caCert: '-----BEGIN-----\\nabc\\n-----END-----' })

    expect(options).toEqual({ ca: '-----BEGIN-----\nabc\n-----END-----', rejectUnauthorized: true })
  })

  it('still encrypts against the local Docker database, without a certificate to check', () => {
    expect(tlsOptions({ tls: 'local' })).toEqual({ rejectUnauthorized: false })
  })
})

describe('database health', () => {
  it('reports the API as down when the database cannot be reached', async () => {
    const unreachable = createDatabase({ url: 'mysql://nobody@127.0.0.1:1/none', tls: 'local' })
    try {
      await expect(pingDatabase(unreachable)).rejects.toThrow()
      await expect(createHealthService([() => pingDatabase(unreachable)]).check()).resolves.toEqual({
        status: 'DOWN',
      })
    } finally {
      await unreachable.destroy()
    }
  })
})
