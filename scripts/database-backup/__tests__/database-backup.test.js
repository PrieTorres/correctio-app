import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DATABASE_TLS, caCertificate, identifier, optionFile, parseDatabaseUrl } from '../client.mjs';
import { backupFileName, backupTakenAt, endsComplete } from '../dump.mjs';
import { MAX_BACKUP_AGE_HOURS, assertLocal, restoreProblems, restoreSummary } from '../restore.mjs';

const connection = { host: 'db.example.com', port: '12345', user: 'app', password: 'a#b\\c', database: 'correctio' };

/** The option file read back as each setting and its raw value, the way MySQL splits a line at the first `=`. */
function settingsOf(file) {
  const [header, ...lines] = file.split('\n').filter((line) => line !== '');
  const settings = Object.fromEntries(lines.map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  return { header, settings };
}

describe('parseDatabaseUrl', () => {
  it('reads every part and decodes the password', () => {
    assert.deepEqual(parseDatabaseUrl('mysql://app:a%23b%5Cc@db.example.com:12345/correctio?ssl=true'), connection);
  });

  it('falls back to the MySQL port', () => {
    assert.equal(parseDatabaseUrl('mysql://app:x@db.example.com/correctio').port, '3306');
  });

  it('refuses another scheme or a missing database without repeating the address', () => {
    assert.throws(() => parseDatabaseUrl('postgres://app:secret@db.example.com/correctio'), (error) => !error.message.includes('secret'));
    assert.throws(() => parseDatabaseUrl('mysql://app:secret@db.example.com/'), /must look like/);
  });
});

describe('optionFile', () => {
  it('verifies the server against the CA and quotes the password', () => {
    const file = optionFile({ connection, tls: DATABASE_TLS.VERIFY, caPath: '/tmp/ca.pem' });
    const { header, settings } = settingsOf(file);

    assert.equal(header, '[client]');
    assert.equal(settings.password, '"a#b\\\\c"');
    assert.equal(settings['ssl-mode'], '"VERIFY_IDENTITY"');
    assert.equal(settings['ssl-ca'], '"/tmp/ca.pem"');
    assert.doesNotMatch(file, /correctio/);
  });

  it('only encrypts for a local database', () => {
    const { settings } = settingsOf(optionFile({ connection, tls: DATABASE_TLS.LOCAL, caPath: undefined }));

    assert.equal(settings['ssl-mode'], '"REQUIRED"');
    assert.equal(settings['ssl-ca'], undefined);
  });

  it('refuses to verify without a CA, an unknown mode and a value it cannot quote', () => {
    assert.throws(() => optionFile({ connection, tls: DATABASE_TLS.VERIFY, caPath: undefined }), /DATABASE_CA_CERT/);
    assert.throws(() => optionFile({ connection, tls: 'off', caPath: undefined }), /DATABASE_TLS/);
    assert.throws(() => optionFile({ connection: { ...connection, password: 'a"b' }, tls: DATABASE_TLS.LOCAL }), /quote/);
  });
});

describe('caCertificate', () => {
  it('turns literal \\n back into line breaks', () => {
    assert.equal(caCertificate('-----BEGIN-----\\nabc\\n-----END-----'), '-----BEGIN-----\nabc\n-----END-----');
  });
});

describe('identifier', () => {
  it('quotes a name and doubles a backtick inside it', () => {
    assert.equal(identifier('users'), '`users`');
    assert.equal(identifier('a`b'), '`a``b`');
  });
});

describe('backup file names', () => {
  it('say when the backup was taken and sort by time', () => {
    const name = backupFileName('correctio', new Date('2026-10-21T06:23:05.432Z'));

    assert.equal(name, 'correctio-2026-10-21T06-23-05Z.sql.gz');
    assert.equal(backupTakenAt(`production/${name}`).toISOString(), '2026-10-21T06:23:05.000Z');
    assert.ok(backupFileName('correctio', new Date('2026-10-22T00:00:00Z')) > name);
  });

  it('refuses a name it did not write', () => {
    assert.throws(() => backupTakenAt('dump.sql'), /not a backup file name/);
  });
});

describe('endsComplete', () => {
  it('accepts a dump that reached its last line and rejects one cut short', () => {
    assert.equal(endsComplete('INSERT INTO a VALUES (1);\n-- Dump completed on 2026-10-21  6:23:05\n'), true);
    assert.equal(endsComplete('INSERT INTO a VALUES (1);\nINSERT INTO a VAL'), false);
    assert.equal(endsComplete(''), false);
  });
});

describe('assertLocal', () => {
  it('allows only this machine', () => {
    assert.doesNotThrow(() => assertLocal({ host: '127.0.0.1' }));
    assert.doesNotThrow(() => assertLocal({ host: 'localhost' }));
    assert.throws(() => assertLocal({ host: 'correctio-mysql.aivencloud.com' }), /this machine/);
  });
});

describe('restoreProblems', () => {
  const backup = 'correctio-2026-10-21T06-23-05Z.sql.gz';
  const taken = new Date('2026-10-21T06:23:05Z').getTime();
  const tables = [{ name: 'classes', rows: 3 }, { name: 'users', rows: 2 }];

  it('passes a recent backup with accounts in it', () => {
    assert.deepEqual(restoreProblems({ backup, tables, now: new Date(taken + 3_600_000) }), []);
  });

  it('flags a backup older than the RNF09 limit', () => {
    const now = new Date(taken + (MAX_BACKUP_AGE_HOURS + 1) * 3_600_000);

    assert.match(restoreProblems({ backup, tables, now }).join(), /27 horas/);
  });

  it('flags a restore with no tables or no accounts', () => {
    const now = new Date(taken);

    assert.match(restoreProblems({ backup, tables: [], now }).join(), /nenhuma tabela/);
    assert.match(restoreProblems({ backup, tables: [{ name: 'users', rows: 0 }], now }).join(), /users/);
    assert.match(restoreProblems({ backup, tables: [{ name: 'classes', rows: 1 }], now }).join(), /users/);
  });
});

describe('restoreSummary', () => {
  it('records the backup, the time it took and the count of each table', () => {
    const summary = restoreSummary({
      backup: 'correctio-2026-10-21T06-23-05Z.sql.gz',
      seconds: 4.26,
      tables: [{ name: 'users', rows: 2 }],
      problems: [],
    });

    assert.match(summary, /✅/);
    assert.match(summary, /4\.3 s/);
    assert.match(summary, /\| `users` \| 2 \|/);
  });

  it('lists what went wrong', () => {
    const summary = restoreSummary({ backup: 'correctio-2026-10-21T06-23-05Z.sql.gz', seconds: 0, tables: [], problems: ['A restauração parou'] });

    assert.match(summary, /❌/);
    assert.match(summary, /- A restauração parou/);
  });
});
