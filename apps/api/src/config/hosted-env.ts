import { DATABASE_TLS } from './env'

/**
 * Proxies between the browser and the function on the web address, measured on
 * the first deploy: `X-Forwarded-For` arrives as `<client>, <Google proxy>`.
 * With one hop the API would read the Google proxy as everyone's address, and
 * the per-address limits would throttle all users together.
 */
const FIREBASE_PROXY_HOPS = 2

/** The two addresses Firebase Hosting gives every project; the web app is served from both. */
function firebaseOrigins(projectId: string): string {
  return `https://${projectId}.web.app,https://${projectId}.firebaseapp.com`
}

/**
 * The environment of the API on Firebase. The secrets (`DATABASE_URL`,
 * `DATABASE_CA_CERT`, `DATA_ENCRYPTION_KEY`) arrive from Secret Manager as
 * variables; what is the same in every project is set here instead of being
 * configured by hand in each one.
 *
 * Production mode and a verified database certificate are applied last, so no
 * variable set on the host can turn either off. The allowed origins follow the
 * project the function runs in, which Firebase sets in `GCLOUD_PROJECT`.
 */
export function hostedEnvSource(runtime: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const projectId = runtime.GCLOUD_PROJECT
  if (projectId === undefined) throw new Error('GCLOUD_PROJECT is not set: this only runs as a Firebase function')

  return {
    CORS_ORIGINS: firebaseOrigins(projectId),
    TRUST_PROXY_HOPS: String(FIREBASE_PROXY_HOPS),
    ...runtime,
    NODE_ENV: 'production',
    DATABASE_TLS: DATABASE_TLS.VERIFY,
  }
}
