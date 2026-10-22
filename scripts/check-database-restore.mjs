#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { restoreDatabase, restoreProblems, restoreSummary } from './database-backup/restore.mjs';

/**
 * A restore that breaks halfway still becomes a record, with the reason as its
 * problem, so a failed month is written down like a passing one.
 */
async function attemptRestore(dumpPath) {
  try {
    return { ...(await restoreDatabase(process.env, dumpPath)), failure: undefined };
  } catch (error) {
    return { seconds: 0, tables: [], failure: `A restauração parou: ${error.message}` };
  }
}

/**
 * `node scripts/check-database-restore.mjs <backup.sql.gz> <report.json>`:
 * restores the backup into the new, local database of `DATABASE_URL`, prints
 * the summary for the run page and writes the same record as JSON, which the
 * monthly workflow keeps in the bucket. Exits with 1 when the test fails.
 */
async function main() {
  const [dumpPath, reportPath] = process.argv.slice(2);
  if (dumpPath === undefined || reportPath === undefined) {
    throw new Error('Usage: node scripts/check-database-restore.mjs <backup.sql.gz> <report.json>');
  }
  const backup = basename(dumpPath);
  const testedAt = new Date();
  const { seconds, tables, failure } = await attemptRestore(dumpPath);
  const problems = [...(failure === undefined ? [] : [failure]), ...restoreProblems({ backup, tables, now: testedAt })];

  const report = { backup, testedAt: testedAt.toISOString(), seconds, tables, problems };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(restoreSummary(report));
  if (problems.length > 0) process.exitCode = 1;
}

await main();
