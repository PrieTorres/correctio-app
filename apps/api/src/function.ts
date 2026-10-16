import type { Express } from 'express'
import { onRequest } from 'firebase-functions/https'
import { defineSecret } from 'firebase-functions/params'
import { bootstrapApi } from './bootstrap'
import { loadEnv } from './config/env'
import { hostedEnvSource } from './config/hosted-env'

/**
 * The path Hosting forwards to this function (`firebase.json`). Web app and API
 * share one origin, so the browser never makes a cross-origin call and each
 * preview link reaches the API of its own project.
 */
const API_BASE_PATH = '/api'

/**
 * Kept in Secret Manager of each Firebase project; declaring them is what lets
 * the function read them. A deploy fails while any of them is missing from the
 * project, so a new secret is created in both projects before the code that
 * declares it is merged.
 */
const SECRETS = [
  'DATABASE_URL',
  'DATABASE_CA_CERT',
  'DATA_ENCRYPTION_KEY',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GMAIL_APP_PASSWORD',
].map((name) => defineSecret(name))

let hostedApp: Express | undefined

/**
 * Built on the first request rather than on import: the Firebase CLI loads this
 * file during deploy only to find the function, when no secret is available,
 * and validating the environment there would fail every deploy.
 */
function appForRequests(): Express {
  hostedApp ??= bootstrapApi(loadEnv(hostedEnvSource(process.env)), { basePath: API_BASE_PATH }).app
  return hostedApp
}

/**
 * Near the database, which runs in San Francisco: each request makes several
 * queries, so the distance that adds up is API to database, not browser to API.
 * One instance only, because the rate limits count in memory and a second
 * instance would double every limit.
 */
export const api = onRequest({ region: 'us-west1', maxInstances: 1, secrets: SECRETS }, (request, response) => {
  appForRequests()(request, response)
})
