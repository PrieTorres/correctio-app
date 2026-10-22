import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { exited, spawnClient, withClient } from './client.mjs';

/**
 * What the daily backup asks of `mysqldump`, so it only reads and never stops
 * the API:
 * - `--single-transaction` takes one consistent snapshot without locking tables;
 * - `--no-tablespaces` and `--set-gtid-purged=OFF` skip what needs privileges
 *   the application user lacks on Aiven, and what a fresh server would refuse
 *   on restore;
 * - `--hex-blob` keeps any binary column byte for byte, whatever the character set.
 *
 * Routines and events are left out: the schema has none.
 */
export const DUMP_OPTIONS = Object.freeze([
  '--single-transaction',
  '--no-tablespaces',
  '--set-gtid-purged=OFF',
  '--hex-blob',
  '--default-character-set=utf8mb4',
  '--triggers',
]);

/** The last line `mysqldump` writes, and only when it reached the end of the database. */
const COMPLETED = '-- Dump completed';

/** True when the dump ends with that line, which is how a cut-short dump is told apart from a whole one. */
export function endsComplete(tail) {
  return tail.trimEnd().split('\n').at(-1)?.startsWith(COMPLETED) ?? false;
}

/**
 * `correctio-2026-10-21T06-23-05Z.sql.gz`: the name says when the backup was
 * taken, and sorting the names sorts the backups by time.
 */
export function backupFileName(database, takenAt) {
  const stamp = takenAt.toISOString().replace(/\.\d{3}Z$/, 'Z').replaceAll(':', '-');
  return `${database}-${stamp}.sql.gz`;
}

const STAMP = /(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z\.sql\.gz$/;

/** Reads back the moment `backupFileName` wrote into the name. */
export function backupTakenAt(fileName) {
  const match = STAMP.exec(fileName);
  if (match === null) throw new Error(`${fileName} is not a backup file name`);
  const [, day, hours, minutes, seconds] = match;
  return new Date(`${day}T${hours}:${minutes}:${seconds}Z`);
}

/** Passes the dump through untouched and keeps its last bytes, to check how it ended. */
function tailKeeper(size = 256) {
  let tail = '';
  const stream = new Transform({
    transform(chunk, _encoding, done) {
      tail = (tail + chunk.toString('latin1')).slice(-size);
      done(null, chunk);
    },
  });
  return { stream, tail: () => tail };
}

/**
 * Dumps the database of `env.DATABASE_URL` to a gzip file in `folder` and
 * returns its path. The dump streams straight into the file, so its size never
 * has to fit in memory.
 */
export function dumpDatabase(env, folder, takenAt = new Date()) {
  return withClient(env, async (client) => {
    const output = join(folder, backupFileName(client.connection.database, takenAt));
    const dump = spawnClient('mysqldump', client, [...DUMP_OPTIONS, client.connection.database]);
    dump.stdin.end();
    const keeper = tailKeeper();
    await Promise.all([
      pipeline(dump.stdout, keeper.stream, createGzip({ level: 9 }), createWriteStream(output, { mode: 0o600 })),
      exited(dump, 'mysqldump'),
    ]);
    if (!endsComplete(keeper.tail())) throw new Error('The dump stopped before mysqldump reached the end of the database');
    return output;
  });
}
