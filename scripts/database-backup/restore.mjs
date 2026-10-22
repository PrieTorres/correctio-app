import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { exited, identifier, parseDatabaseUrl, query, spawnClient, withClient } from './client.mjs';
import { backupTakenAt } from './dump.mjs';

/**
 * Restoring creates a database and writes into it, so it only ever runs against
 * a MySQL on this machine: the throwaway one of CI or Docker. A hosted address
 * is refused, so a mistaken URL can never overwrite production.
 */
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/** The RNF09 limit on lost data is 24 hours; two more cover a daily run that started late. */
export const MAX_BACKUP_AGE_HOURS = 26;

/** Production always has at least one account, so an empty table means the dump came out empty. */
const ALWAYS_FILLED_TABLE = 'users';

const HOUR_MS = 3_600_000;

/** Fails unless the address points at this machine. */
export function assertLocal(connection) {
  if (!LOCAL_HOSTS.has(connection.host)) throw new Error('A restore test only runs against a MySQL on this machine');
}

/** Each base table of the database with its exact row count, in name order. */
async function tableCounts(client, database) {
  const names = await query(
    client,
    "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name",
    database,
  );
  if (names.length === 0) return [];
  const counts = names.map(([name]) => `SELECT '${name.replaceAll("'", "''")}', COUNT(*) FROM ${identifier(name)}`);
  const rows = await query(client, counts.join(' UNION ALL '), database);
  return rows.map(([name, count]) => ({ name, rows: Number(count) }));
}

/**
 * Loads a backup into a database that does not exist yet, so nothing already
 * there is ever overwritten, and returns how long it took and what came back.
 */
export function restoreDatabase(env, dumpPath) {
  assertLocal(parseDatabaseUrl(env.DATABASE_URL ?? ''));
  return withClient(env, async (client) => {
    const { database } = client.connection;
    await query(client, `CREATE DATABASE ${identifier(database)} CHARACTER SET utf8mb4`);
    const started = performance.now();
    const mysql = spawnClient('mysql', client, ['--default-character-set=utf8mb4', database]);
    await Promise.all([pipeline(createReadStream(dumpPath), createGunzip(), mysql.stdin), exited(mysql, 'mysql')]);
    const seconds = (performance.now() - started) / 1000;
    return { seconds, tables: await tableCounts(client, database) };
  });
}

/**
 * What makes a restore test fail, in the words of the run summary: a backup
 * older than the RNF09 limit, or one that brought back no data.
 */
export function restoreProblems({ backup, tables, now }) {
  const problems = [];
  const ageHours = (now.getTime() - backupTakenAt(backup).getTime()) / HOUR_MS;
  if (ageHours > MAX_BACKUP_AGE_HOURS) {
    problems.push(`O backup mais recente tem ${Math.floor(ageHours)} horas, acima do limite de ${MAX_BACKUP_AGE_HOURS} horas`);
  }
  const filled = tables.find((table) => table.name === ALWAYS_FILLED_TABLE);
  if (tables.length === 0) problems.push('O backup não trouxe nenhuma tabela');
  else if (filled === undefined || filled.rows === 0) problems.push(`A tabela \`${ALWAYS_FILLED_TABLE}\` voltou vazia`);
  return problems;
}

/**
 * The record of one restore test, written to the run summary. It holds counts
 * and times only, never a row of data.
 */
export function restoreSummary({ backup, seconds, tables, problems }) {
  const verdict = problems.length === 0 ? '✅ Restauração funcionou' : '❌ Restauração falhou';
  return [
    `### ${verdict}`,
    '',
    `Backup: \`${backup}\`, de ${backupTakenAt(backup).toISOString()}. Restaurado em ${seconds.toFixed(1)} s.`,
    ...problems.map((problem) => `- ${problem}`),
    '',
    '| Tabela | Linhas |',
    '|---|---:|',
    ...tables.map((table) => `| \`${table.name}\` | ${table.rows} |`),
    '',
  ].join('\n');
}
