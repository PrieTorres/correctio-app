import { z } from 'zod'

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const

/**
 * `verify` checks the server certificate against `DATABASE_CA_CERT`, which is
 * what the hosted database needs. `local` still encrypts but accepts the
 * self-signed certificate of the Docker MySQL. Neither allows a plain
 * connection.
 */
export const DATABASE_TLS = Object.freeze({ VERIFY: 'verify', LOCAL: 'local' } as const)

/**
 * An origin is scheme and host only. A browser sends `https://correctio-app.web.app`
 * even when the page is `/turmas/42`, so a path here would match nothing and
 * every request from the published site would be refused.
 */
const origin = z
  .string()
  .url()
  .refine((value) => new URL(value).origin === value, 'Use only scheme and host, without a path or trailing slash')

/** An empty line in `.env` means "not set", not an empty value. */
const optionalText = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value.trim() === '' ? undefined : value))

/** At least 32 random bytes in base64: a shorter HS256 secret can be brute-forced from one token. */
const signingSecret = optionalText.refine(
  (value) => value === undefined || Buffer.from(value, 'base64').length >= 32,
  'Must be at least 32 bytes in base64',
)

/** AES-256 needs exactly 32 bytes; anything else would fail only on the first encryption. */
const encryptionKey = optionalText.refine(
  (value) => value === undefined || Buffer.from(value, 'base64').length === 32,
  'Must be 32 bytes in base64',
)

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:5173,http://localhost:4173')
      .transform((value) => value.split(',').map((item) => item.trim()).filter(Boolean))
      .pipe(z.array(origin).min(1)),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
    DATABASE_URL: optionalText.pipe(z.string().startsWith('mysql://').optional()),
    DATABASE_TLS: z.enum([DATABASE_TLS.VERIFY, DATABASE_TLS.LOCAL]).default(DATABASE_TLS.VERIFY),
    DATABASE_CA_CERT: optionalText,
    DATA_ENCRYPTION_KEY: encryptionKey,
    /** Signs the access tokens and the Google sign-in state. */
    JWT_SECRET: signingSecret,
    /**
     * The fixed address of this environment's web app: where Google returns to
     * and what the password reset e-mail links to.
     */
    PUBLIC_APP_URL: origin.default('http://localhost:5173'),
    /** Both or neither: without them, sign-in with Google is simply not offered. */
    GOOGLE_CLIENT_ID: optionalText,
    GOOGLE_CLIENT_SECRET: optionalText,
    /** The app password of the project's Gmail, which sends the password reset e-mail. */
    GMAIL_APP_PASSWORD: optionalText,
    MAIL_FROM: z.string().email().default('correctioapp@gmail.com'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'test' && env.DATABASE_URL === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['DATABASE_URL'], message: 'Required outside tests' })
    }
    if ((env.GOOGLE_CLIENT_ID === undefined) !== (env.GOOGLE_CLIENT_SECRET === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['GOOGLE_CLIENT_ID'], message: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET together' })
    }
    if (env.NODE_ENV !== 'production') return

    if (env.DATABASE_TLS !== DATABASE_TLS.VERIFY || env.DATABASE_CA_CERT === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_TLS'],
        message: 'Production must verify the database certificate: set DATABASE_TLS=verify and DATABASE_CA_CERT',
      })
    }
    if (env.JWT_SECRET === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_SECRET'], message: 'Required in production' })
    }
    if (env.DATA_ENCRYPTION_KEY === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['DATA_ENCRYPTION_KEY'], message: 'Required in production' })
    }
  })

export type Env = Readonly<z.output<typeof envSchema>>

/**
 * Reads and validates the environment once, at startup. A missing or malformed
 * value stops the server with a message naming the variable, instead of
 * surfacing later as a request that fails for no visible reason.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    throw new Error(`Invalid environment:\n${problems.join('\n')}`)
  }
  return Object.freeze(result.data)
}
