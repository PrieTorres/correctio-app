import { describe, expect, it } from 'vitest'
import { createHealthService } from '../health-service'

describe('health service', () => {
  it('is up when there is nothing to check yet', async () => {
    await expect(createHealthService().check()).resolves.toEqual({ status: 'UP' })
  })

  it('is up only when every dependency answers', async () => {
    const service = createHealthService([() => Promise.resolve(true), () => Promise.resolve(false)])

    await expect(service.check()).resolves.toEqual({ status: 'DOWN' })
  })

  it('reports a dependency that throws as down instead of failing', async () => {
    const service = createHealthService([() => Promise.reject(new Error('timeout'))])

    await expect(service.check()).resolves.toEqual({ status: 'DOWN' })
  })
})
