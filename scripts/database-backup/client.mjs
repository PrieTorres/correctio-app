import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * How the client checks the server, with the values of the API's `DATABASE_TLS`.
 * `verify` checks the certificate against the CA and the host name; `local` only
 * encrypts, for the throwaway MySQL of Docker and CI.
 */
export const DATABASE_TLS = Object.freeze({ VERIFY: 'verify', LOCAL: 'local' });

/**
 * Splits a `mysql://user:password@host:port/database` address. Anything else
 * fails before connecting, and the message never repeats the address, which
 * carries the password.
 */
export function parseDatabaseUrl(address) {
  const url = new URL(address);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (url.protocol !== 'mysql:' || url.hostname === '' || database === '') {
    throw new Error('DATABASE_URL must look like mysql://user:password@host:port/database');
  }
  return {
    host: url.hostname,
    port: url.port === '' ? '3306' : url.port,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  };
}

/**
 * The CA arrives from a secret, often with literal `\n` instead of line breaks,
 * the same way the API receives it.
 */
export function caCertificate(text) {
  return text.replace(/\\n/g, '\n');
}

/**
 * The TLS lines of the option file. Verifying the server without its CA would
 * silently trust any certificate, so it is refused instead.
 */
function tlsSettings(tls, caPath) {
  if (tls === DATABASE_TLS.LOCAL) return { 'ssl-mode': 'REQUIRED' };
  if (tls !== DATABASE_TLS.VERIFY) throw new Error(`DATABASE_TLS must be ${DATABASE_TLS.VERIFY} or ${DATABASE_TLS.LOCAL}`);
  if (caPath === undefined) throw new Error('Verifying the database certificate needs DATABASE_CA_CERT');
  return { 'ssl-mode': 'VERIFY_IDENTITY', 'ssl-ca': caPath };
}

/**
 * Quoted, so a `#` in a password is not read as the start of a comment. A quote
 * or a line break cannot be written safely, so the value is refused rather than
 * cut short.
 */
function optionValue(value) {
  if (/["\n\r]/.test(value)) throw new Error('A database setting contains a quote or a line break');
  return `"${value.replaceAll('\\', '\\\\')}"`;
}

/**
 * The `[client]` option file read by `mysql` and `mysqldump`. The password goes
 * here, never on the command line, where any process on the machine can read it.
 */
export function optionFile({ connection, tls, caPath }) {
  const settings = {
    host: connection.host,
    port: connection.port,
    user: connection.user,
    password: connection.password,
    ...tlsSettings(tls, caPath),
  };
  const lines = Object.entries(settings).map(([key, value]) => `${key}=${optionValue(value)}`);
  return ['[client]', ...lines, ''].join('\n');
}

/**
 * Writes the option file, and the CA when there is one, to a private temporary
 * folder that only this user can read. `dispose` removes it.
 */
export async function prepareClient(env) {
  const connection = parseDatabaseUrl(env.DATABASE_URL ?? '');
  const tls = env.DATABASE_TLS ?? DATABASE_TLS.VERIFY;
  const folder = await mkdtemp(join(tmpdir(), 'correctio-db-'));
  const dispose = () => rm(folder, { recursive: true, force: true });
  try {
    const caPath = env.DATABASE_CA_CERT ? join(folder, 'ca.pem') : undefined;
    if (caPath !== undefined) await writeFile(caPath, caCertificate(env.DATABASE_CA_CERT), { mode: 0o600 });
    const optionsPath = join(folder, 'client.cnf');
    await writeFile(optionsPath, optionFile({ connection, tls, caPath }), { mode: 0o600 });
    return { connection, optionsPath, dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
}

/** Prepares the client for `use` and removes its files afterwards, whatever happens. */
export async function withClient(env, use) {
  const client = await prepareClient(env);
  try {
    return await use(client);
  } finally {
    await client.dispose();
  }
}

/**
 * Starts `mysql` or `mysqldump`, which both require the option file as the
 * first argument. Their own errors go straight to stderr.
 */
export function spawnClient(program, client, args) {
  return spawn(program, [`--defaults-extra-file=${client.optionsPath}`, ...args], { stdio: ['pipe', 'pipe', 'inherit'] });
}

/** Settles when the program exits: resolved on success, rejected with its exit code otherwise. */
export function exited(child, program) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => (code === 0 ? resolve() : reject(new Error(`${program} exited with code ${code}`))));
  });
}

/**
 * Runs SQL and returns the rows, each one an array of columns. `database` is
 * left out for statements such as `CREATE DATABASE`, which run before it exists.
 */
export async function query(client, sql, database) {
  const args = ['--batch', '--skip-column-names', '--default-character-set=utf8mb4', '--execute', sql];
  const child = spawnClient('mysql', client, database === undefined ? args : [...args, database]);
  child.stdin.end();
  let output = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => {
    output += chunk;
  });
  await exited(child, 'mysql');
  return output
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.split('\t'));
}

/** A name quoted for MySQL, so a table name is never read as SQL. */
export function identifier(name) {
  return `\`${name.replaceAll('`', '``')}\``;
}
