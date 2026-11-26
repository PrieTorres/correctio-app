import { pino, type Logger, type LevelWithSilent, type SerializedRequest, type SerializedResponse } from 'pino'
import { pinoHttp, type HttpLogger } from 'pino-http'

/**
 * Structured JSON to stdout: the hosting platform collects and rotates it, and
 * each line can be searched by field instead of by guesswork.
 */
export function createLogger(level: LevelWithSilent): Logger {
  return pino({ level, redact: ['req.headers.authorization', 'req.headers.cookie'] })
}

/** The public lookup answers at `/public/sheets/<code>`, and the code printed on a sheet opens that student's page. */
const PUBLIC_SHEET_CODE = /(\/public\/sheets\/)[^/?]+/

/**
 * Where a request went, as the log may keep it: without the query string,
 * which carries one-time codes on the Google sign-in return, and with the code
 * of a sheet replaced by `:code`.
 */
function loggedPath(url: string): string {
  const [path = ''] = url.split('?')
  return path.replace(PUBLIC_SHEET_CODE, '$1:code')
}

/**
 * One line per request with the fields chosen here and nothing else (RNF05):
 * the request id, the method, the path and the status. The headers are left
 * out instead of hidden one by one, because they carry the session cookie, its
 * renewal in `Set-Cookie` and, behind Hosting, the client's address in
 * `X-Forwarded-For`.
 */
export function createHttpLogger(logger: Logger): HttpLogger {
  return pinoHttp({
    logger,
    serializers: {
      req: (req: SerializedRequest) => ({ id: req.id, method: req.method, path: loggedPath(req.url) }),
      res: (res: SerializedResponse) => ({ statusCode: res.statusCode }),
    },
  })
}
