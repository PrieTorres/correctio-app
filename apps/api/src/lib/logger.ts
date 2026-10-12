import { pino, type Logger, type LevelWithSilent } from 'pino'

/**
 * Structured JSON to stdout: the hosting platform collects and rotates it, and
 * each line can be searched by field instead of by guesswork.
 */
export function createLogger(level: LevelWithSilent): Logger {
  return pino({ level, redact: ['req.headers.authorization', 'req.headers.cookie'] })
}
