import { bootstrapApi } from './bootstrap'
import { loadEnv } from './config/env'

const SHUTDOWN_TIMEOUT_MS = 10_000

const env = loadEnv()
const { app, db, logger } = bootstrapApi(env)
const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'API listening')
})

/**
 * Stops taking connections and lets the requests in flight finish, which is
 * what the host expects on a deploy. A request that hangs past the timeout
 * does not keep the old version alive forever.
 */
function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, 'Shutting down')
  server.close((error) => {
    if (error) logger.error({ err: error }, 'Shutdown failed')
    void db.destroy().finally(() => process.exit(error ? 1 : 0))
  })
  setTimeout(() => {
    logger.error('Shutdown timed out')
    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS).unref()
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

/** Continuing after an unknown failure risks serving from a broken state; the host restarts a clean process. */
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled rejection')
  process.exit(1)
})
