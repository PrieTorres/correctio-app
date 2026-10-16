import { randomUUID } from 'node:crypto'
import { sql, type Kysely } from 'kysely'
import { createDatabase } from '../db/connection'
import { MIGRATION_COMMAND, migrate } from '../db/migrator'
import type { Database } from '../models/tables'

/**
 * The MySQL the database tests run against: `docker compose up -d mysql`
 * locally, the MySQL service in CI. In CI a missing database is a failure,
 * never a skipped test, because a skipped check is how a renamed column would
 * get through.
 */
export const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL
if (DATABASE_TEST_URL === undefined && process.env.CI !== undefined) {
  throw new Error('DATABASE_TEST_URL is required in CI')
}

export interface TestDatabase {
  db: Kysely<Database>
  drop: () => Promise<void>
}

/** A database of its own per test file, migrated to the latest schema, so files never see each other's rows. */
export async function createTestDatabase(): Promise<TestDatabase> {
  if (DATABASE_TEST_URL === undefined) throw new Error('DATABASE_TEST_URL is not set')

  const name = `correctio_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`
  const server = createDatabase({ url: DATABASE_TEST_URL, tls: 'local' })
  await sql`CREATE DATABASE ${sql.id(name)}`.execute(server)

  const url = new URL(DATABASE_TEST_URL)
  url.pathname = `/${name}`
  const db = createDatabase({ url: url.toString(), tls: 'local' })
  await migrate(db, MIGRATION_COMMAND.LATEST)

  return {
    db,
    async drop() {
      await db.destroy()
      await sql`DROP DATABASE IF EXISTS ${sql.id(name)}`.execute(server)
      await server.destroy()
    },
  }
}
