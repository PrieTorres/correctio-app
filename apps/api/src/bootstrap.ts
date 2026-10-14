import type { Express } from 'express'
import type { Kysely } from 'kysely'
import type { Logger } from 'pino'
import { createApp } from './app'
import type { Env } from './config/env'
import { createDatabase } from './db/connection'
import { createFieldCipher } from './lib/field-encryption'
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
 *
 * The encryption key is required here rather than in `loadEnv`: the migrations
 * read the same environment and run in the deploy without the key, which only
 * the API that serves requests needs. Starting without it would surface later
 * as a student that cannot be saved; refusing to start names the variable now.
 */
export function bootstrapApi(env: Env, { basePath }: { basePath?: string } = {}): Api {
  if (env.DATABASE_URL === undefined) throw new Error('DATABASE_URL is required')
  if (env.DATA_ENCRYPTION_KEY === undefined) throw new Error('DATA_ENCRYPTION_KEY is required')

  const logger = createLogger(env.LOG_LEVEL)
  const db = createDatabase({ url: env.DATABASE_URL, tls: env.DATABASE_TLS, caCert: env.DATABASE_CA_CERT })
  const app = createApp({
    env,
    logger,
    db,
    fieldCipher: createFieldCipher(env.DATA_ENCRYPTION_KEY),
    basePath,
    healthChecks: [() => pingDatabase(db)],
  })
  return { app, db, logger }
}
