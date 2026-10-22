#!/usr/bin/env node
import { dumpDatabase } from './database-backup/dump.mjs';

/**
 * `node scripts/backup-database.mjs <folder>`: dumps the database of
 * `DATABASE_URL` into the folder and prints the path of the file, which the
 * daily backup workflow uploads. Reads `DATABASE_TLS` and `DATABASE_CA_CERT`
 * like the API does.
 */
async function main() {
  const folder = process.argv[2];
  if (folder === undefined) throw new Error('Usage: node scripts/backup-database.mjs <folder>');
  console.log(await dumpDatabase(process.env, folder));
}

await main();
