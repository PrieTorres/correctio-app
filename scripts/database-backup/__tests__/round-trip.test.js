import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DATABASE_TLS, identifier, query, withClient } from '../client.mjs';
import { dumpDatabase } from '../dump.mjs';
import { restoreDatabase } from '../restore.mjs';

const server = process.env.DATABASE_TEST_URL;

/**
 * Needs a MySQL and the MySQL client tools. A machine without them skips it,
 * but CI never does: a backup that was never restored is not a backup, so a
 * missing tool there fails the test instead of hiding it.
 */
function missingRequirement() {
  if (process.env.CI) return false;
  if (server === undefined) return 'needs DATABASE_TEST_URL';
  const tool = spawnSync('mysqldump', ['--version'], { encoding: 'utf8' });
  if (tool.status !== 0 || tool.stdout.includes('MariaDB')) return 'needs the mysqldump of MySQL 8';
  return false;
}

const suffix = `${process.pid}_${Date.now()}`;
const source = { DATABASE_URL: `${server}/backup_source_${suffix}`, DATABASE_TLS: DATABASE_TLS.LOCAL };
const restored = { DATABASE_URL: `${server}/backup_restored_${suffix}`, DATABASE_TLS: DATABASE_TLS.LOCAL };

/** Accents, JSON, binary and decimal columns are where a careless dump changes data on the way back. */
const SEED = `
  CREATE TABLE users (id CHAR(1) PRIMARY KEY, full_name VARCHAR(200), photo VARBINARY(8), score DECIMAL(5,2), settings JSON);
  INSERT INTO users VALUES ('a', 'Conceição Araújo', 0x00FF10, 9.5, '{"tags":["ç"]}'), ('b', 'José', NULL, 10, NULL);
  CREATE TABLE archived (id INT PRIMARY KEY);
`;

const ROWS = 'SELECT id, full_name, HEX(photo), score, settings FROM users ORDER BY id';

/** Runs SQL against the server of `env`, in its database or before it exists. */
function sql(env, statement, database) {
  return withClient(env, (client) => query(client, statement, database));
}

/** Drops a database the test created, if it got that far. */
function drop(env, name) {
  return sql(env, `DROP DATABASE IF EXISTS ${identifier(name)}`);
}

describe('backup round trip', { skip: missingRequirement() }, () => {
  let folder;

  before(async () => {
    folder = await mkdtemp(join(tmpdir(), 'correctio-backup-test-'));
    await sql(source, `CREATE DATABASE ${identifier(`backup_source_${suffix}`)} CHARACTER SET utf8mb4`);
    await sql(source, SEED, `backup_source_${suffix}`);
  });

  after(async () => {
    await drop(source, `backup_source_${suffix}`);
    await drop(restored, `backup_restored_${suffix}`);
    await rm(folder, { recursive: true, force: true });
  });

  it('brings every table and every value back unchanged', async () => {
    const dump = await dumpDatabase(source, folder);
    const result = await restoreDatabase(restored, dump);

    assert.deepEqual(result.tables, [{ name: 'archived', rows: 0 }, { name: 'users', rows: 2 }]);
    assert.deepEqual(await sql(restored, ROWS, `backup_restored_${suffix}`), await sql(source, ROWS, `backup_source_${suffix}`));
  });

  it('never restores over a database that already exists', async () => {
    const dump = await dumpDatabase(source, folder, new Date('2026-01-01T00:00:00Z'));

    await assert.rejects(restoreDatabase(restored, dump), /mysql exited/);
  });
});
