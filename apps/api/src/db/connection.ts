import { Kysely, MysqlDialect } from 'kysely'
import { createPool, type SslOptions, type TypeCast } from 'mysql2'
import { DATABASE_TLS } from '../config/env'
import type { Database } from '../models/tables'

export interface DatabaseConfig {
  url: string
  tls: (typeof DATABASE_TLS)[keyof typeof DATABASE_TLS]
  caCert?: string | undefined
}

/**
 * Always TLS: passing `ssl` makes mysql2 refuse a server that cannot encrypt.
 * A certificate kept in a secret often arrives with literal `\n`, so they are
 * turned back into line breaks before use.
 */
export function tlsOptions({ tls, caCert }: Pick<DatabaseConfig, 'tls' | 'caCert'>): SslOptions {
  if (tls === DATABASE_TLS.LOCAL) return { rejectUnauthorized: false }
  return { ca: caCert?.replace(/\\n/g, '\n'), rejectUnauthorized: true }
}

/** MySQL stores a boolean as `TINYINT(1)`; the contract wants `true` and `false`, not `1` and `0`. */
const castBooleans: TypeCast = (field, next) => {
  if (field.type !== 'TINY' || field.length !== 1) return next()
  const value = field.string()
  return value === null ? null : value === '1'
}

/**
 * A small pool: the hosted plan allows few connections and the API runs as a
 * single instance. Dates are read and written in UTC, and decimals come back as
 * numbers, as the contract expects.
 */
export function createDatabase({ url, tls, caCert }: DatabaseConfig): Kysely<Database> {
  const pool = createPool({
    uri: url,
    ssl: tlsOptions({ tls, caCert }),
    timezone: 'Z',
    decimalNumbers: true,
    typeCast: castBooleans,
    connectionLimit: 5,
  })
  return new Kysely<Database>({ dialect: new MysqlDialect({ pool }) })
}
