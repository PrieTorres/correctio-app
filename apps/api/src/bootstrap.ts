import type { Express } from 'express'
import type { Kysely } from 'kysely'
import type { Logger } from 'pino'
import { createApp } from './app'
import { composeAuth } from './compose-auth'
import type { Env } from './config/env'
import { createDatabase } from './db/connection'
import { createLogger } from './lib/logger'
import type { Database } from './models/tables'
import { pingDatabase } from './repositories/database-health-repository'

export interface Api {
  app: Express
  db: Kysely<Database>
  logger: Logger
}

/**
 * Everything the API needs, built from a validated environment. The local
 * server and the Firebase function both start here, so the two can only differ
 * in how they receive requests, never in what answers them.
 */
export function bootstrapApi(env: Env, { basePath }: { basePath?: string } = {}): Api {
  if (env.DATABASE_URL === undefined) throw new Error('DATABASE_URL is required')

  const logger = createLogger(env.LOG_LEVEL)
  const db = createDatabase({ url: env.DATABASE_URL, tls: env.DATABASE_TLS, caCert: env.DATABASE_CA_CERT })
  const app = createApp({ env, logger, db, basePath, healthChecks: [() => pingDatabase(db)], auth: composeAuth({ env, db, logger }) })
  return { app, db, logger }
}