import { z } from 'zod'

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const

/**
 * An origin is scheme and host only. A browser sends `https://prietorres.github.io`
 * even when the page lives under `/correctio-app/`, so a path here would match
 * nothing and every request from the published site would be refused.
 */
const origin = z
  .string()
  .url()
  .refine((value) => new URL(value).origin === value, 'Use only scheme and host, without a path or trailing slash')

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:4173')
    .transform((value) => value.split(',').map((item) => item.trim()).filter(Boolean))
    .pipe(z.array(origin).min(1)),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
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
