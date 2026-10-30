#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { DATABASE_TLS, caCertificate, parseDatabaseUrl } from './database-backup/client.mjs';
import { buildSchema, dictionaryGaps, replaceGenerated, toMermaid, toPlantUml } from './data-model/er-diagram.mjs';

/**
 * The MySQL driver the API already depends on, borrowed through its package,
 * so this script adds no dependency to the repository root.
 */
const mysql = createRequire(new URL('../apps/api/package.json', import.meta.url))('mysql2/promise');

const DOCS = new URL('../docs/data-model/', import.meta.url);

const COLUMNS_SQL = `
  SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, COLUMN_TYPE AS columnType,
         IS_NULLABLE AS isNullable, COLUMN_KEY AS columnKey
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = ?
  ORDER BY TABLE_NAME, ORDINAL_POSITION`;

const FOREIGN_KEYS_SQL = `
  SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, REFERENCED_TABLE_NAME AS referencedTable
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
  ORDER BY TABLE_NAME, COLUMN_NAME`;

/**
 * The same TLS rule as the API: `local` only encrypts, for the MySQL of Docker;
 * anything else verifies the server, which is refused without its CA.
 */
function tlsOptions(env) {
  if (env.DATABASE_TLS === DATABASE_TLS.LOCAL) return { rejectUnauthorized: false };
  if (!env.DATABASE_CA_CERT) throw new Error('Verifying the database certificate needs DATABASE_CA_CERT');
  return { ca: caCertificate(env.DATABASE_CA_CERT), rejectUnauthorized: true };
}

/** Reads the tables and foreign keys of the database of `DATABASE_URL`. It only runs `SELECT`. */
async function readSchema(env) {
  const { host, port, user, password, database } = parseDatabaseUrl(env.DATABASE_URL ?? '');
  const connection = await mysql.createConnection({ host, port: Number(port), user, password, database, ssl: tlsOptions(env) });
  try {
    const [columns] = await connection.execute(COLUMNS_SQL, [database]);
    const [foreignKeys] = await connection.execute(FOREIGN_KEYS_SQL, [database]);
    return buildSchema({ columns, foreignKeys });
  } finally {
    await connection.end();
  }
}

/**
 * `npm run docs:er-diagram`: rewrites the PlantUML source and the Mermaid block
 * of `docs/data-model` from the database of `DATABASE_URL`, which must already
 * be migrated (`npm run db:migrate`). Exits with 1 when the data dictionary
 * misses a column the database has, or lists one it no longer has.
 */
async function main() {
  const tables = await readSchema(process.env);
  await writeFile(new URL('er-diagram.puml', DOCS), toPlantUml(tables));

  const page = new URL('er-diagram.md', DOCS);
  await writeFile(page, replaceGenerated(await readFile(page, 'utf8'), toMermaid(tables)));

  const gaps = dictionaryGaps(tables, await readFile(new URL('data-dictionary.md', DOCS), 'utf8'));
  console.log(`ER diagram: ${tables.length} tables written to docs/data-model.`);
  gaps.forEach((gap) => console.error(`  ${gap}`));
  if (gaps.length > 0) process.exitCode = 1;
}

await main();
