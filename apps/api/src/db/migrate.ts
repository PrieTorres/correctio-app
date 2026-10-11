import { loadEnv } from '../config/env'
import { createLogger } from '../lib/logger'
import { createDatabase } from './connection'
import { MIGRATION_COMMAND, migrate, type MigrationCommand } from './migrator'

const COMMANDS = new Set<string>(Object.values(MIGRATION_COMMAND))

function isCommand(value: string | undefined): value is MigrationCommand {
  return value !== undefined && COMMANDS.has(value)
}

/** `npm run db:migrate`, `db:rollback` and `db:reset` land here, with the database of `.env`. */
async function main(): Promise<void> {
  const command = process.argv[2]
  if (!isCommand(command)) throw new Error(`Use one of: ${[...COMMANDS].join(', ')}`)

  const env = loadEnv()
  if (env.DATABASE_URL === undefined) throw new Error('DATABASE_URL is required')

  const logger = createLogger(env.LOG_LEVEL)
  const db = createDatabase({ url: env.DATABASE_URL, tls: env.DATABASE_TLS, caCert: env.DATABASE_CA_CERT })
  try {
    const { results = [] } = await migrate(db, command)
    for (const item of results) logger.info({ migration: item.migrationName, direction: item.direction }, item.status)
    if (results.length === 0) logger.info('Nothing to migrate')
  } finally {
    await db.destroy()
  }
}

await main()
