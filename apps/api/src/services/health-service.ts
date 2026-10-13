export const HEALTH_STATUS = Object.freeze({
  UP: 'UP',
  DOWN: 'DOWN',
} as const)

export type HealthStatus = (typeof HEALTH_STATUS)[keyof typeof HEALTH_STATUS]

export interface HealthReport {
  status: HealthStatus
}

/**
 * A dependency the API cannot serve without, such as the database that #32
 * adds. It answers whether that dependency is reachable right now.
 */
export type HealthCheck = () => Promise<boolean>

export interface HealthService {
  check: () => Promise<HealthReport>
}

/**
 * The API is up only when every dependency answers. A check that throws counts
 * as down, so a broken dependency is reported instead of crashing the probe.
 */
export function createHealthService(checks: readonly HealthCheck[] = []): HealthService {
  return {
    async check() {
      const results = await Promise.all(checks.map((check) => check().catch(() => false)))
      return { status: results.every(Boolean) ? HEALTH_STATUS.UP : HEALTH_STATUS.DOWN }
    },
  }
}
