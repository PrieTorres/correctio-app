/**
 * Same origin by default: on Firebase, Hosting forwards `/api/**` to the API
 * function, and locally the Vite dev server and preview forward `/api` to the
 * API on port 3000. A build only sets `VITE_API_URL` to point somewhere else.
 */
const DEFAULT_API_URL = '/api'

/** The only place that reads `VITE_API_URL`, without the trailing slash paths are appended to. */
export function apiBaseUrl(env: Pick<ImportMetaEnv, 'VITE_API_URL'> = import.meta.env): string {
  const configured = env.VITE_API_URL?.trim()
  const url = configured === undefined || configured === '' ? DEFAULT_API_URL : configured
  return url.replace(/\/+$/, '')
}
