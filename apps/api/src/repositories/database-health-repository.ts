import { sql, type Kysely } from 'kysely'
import type { Database } from '../models/tables'

/** Resolves when the database answers a query, and rejects when it does not. */
export async function pingDatabase(db: Kysely<Database>): Promise<boolean> {
  await sql`SELECT 1`.execute(db)
  return true
}
