import { Migrator, NO_MIGRATIONS, type Kysely, type MigrationResultSet } from 'kysely'
import type { Database } from '../models/tables'
import { MIGRATIONS } from './migrations'

export const MIGRATION_COMMAND = Object.freeze({ LATEST: 'latest', DOWN: 'down', RESET: 'reset' } as const)

export type MigrationCommand = (typeof MIGRATION_COMMAND)[keyof typeof MIGRATION_COMMAND]

const RUN: Readonly<Record<MigrationCommand, (migrator: Migrator) => Promise<MigrationResultSet>>> = {
  [MIGRATION_COMMAND.LATEST]: (migrator) => migrator.migrateToLatest(),
  [MIGRATION_COMMAND.DOWN]: (migrator) => migrator.migrateDown(),
  [MIGRATION_COMMAND.RESET]: (migrator) => migrator.migrateTo(NO_MIGRATIONS),
}

/**
 * `latest` applies what is pending, `down` undoes the last one and `reset`
 * undoes them all. A failure is thrown with the migration that caused it, so a
 * deploy stops instead of running against a half-built schema.
 */
export async function migrate(db: Kysely<Database>, command: MigrationCommand): Promise<MigrationResultSet> {
  const migrator = new Migrator({ db, provider: { getMigrations: () => Promise.resolve({ ...MIGRATIONS }) } })
  const result = await RUN[command](migrator)

  if (result.error !== undefined) {
    const failed = result.results?.find((item) => item.status === 'Error')?.migrationName ?? 'unknown'
    throw new Error(`Migration ${failed} failed`, { cause: result.error })
  }
  return result
}
