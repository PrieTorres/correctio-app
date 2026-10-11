import { DATABASE_TLS } from './env'

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
    ...runtime,
    NODE_ENV: 'production',
    DATABASE_TLS: DATABASE_TLS.VERIFY,
  }
}
