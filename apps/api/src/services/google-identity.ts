import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose'
import { z } from 'zod'

const AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CERTIFICATES_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com']
const GOOGLE_TIMEOUT_MS = 10_000

export interface GoogleProfile {
  email: string
  fullName: string
}

/**
 * Who Google says the person is, and nothing else: the session that follows is
 * always the API's own (decision of 14/10 on #40).
 */
export interface GoogleIdentity {
  authorizationUrl: (state: string) => string
  /** `null` when Google refuses the code or does not vouch for the e-mail. */
  identify: (code: string) => Promise<GoogleProfile | null>
}

export interface GoogleIdentityOptions {
  clientId: string
  clientSecret: string
  /** Fixed per Firebase project and registered in the Google client; preview links come back through it too. */
  redirectUri: string
  /** Overridable so tests sign their own ID tokens. */
  keys?: JWTVerifyGetKey
  fetch?: typeof fetch
}

const tokenResponseSchema = z.object({ id_token: z.string().min(1) })

/** Only an address Google itself verified may sign in to the account that has it. */
const profileSchema = z.object({
  email: z.string().email(),
  email_verified: z.literal(true),
  name: z.string().trim().min(1).optional(),
})

function toProfile(payload: JWTPayload): GoogleProfile | null {
  const claims = profileSchema.safeParse(payload)
  if (!claims.success) return null
  const { email, name } = claims.data
  return { email, fullName: (name ?? email.split('@')[0] ?? email).slice(0, 160) }
}

/**
 * The server-side code flow: the browser brings back only a code, and the API
 * trades it with Google using the client secret. The ID token arrives straight
 * from Google, and its signature is still checked against Google's keys.
 */
export function createGoogleIdentity({
  clientId,
  clientSecret,
  redirectUri,
  keys = createRemoteJWKSet(new URL(CERTIFICATES_URL)),
  fetch: send = fetch,
}: GoogleIdentityOptions): GoogleIdentity {
  return {
    authorizationUrl(state) {
      const url = new URL(AUTHORIZATION_URL)
      url.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        prompt: 'select_account',
      }).toString()
      return url.toString()
    },

    async identify(code) {
      const response = await send(TOKEN_URL, {
        method: 'POST',
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
        signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
      })
      if (!response.ok) return null

      const tokens = tokenResponseSchema.safeParse(await response.json())
      if (!tokens.success) return null
      const { payload } = await jwtVerify(tokens.data.id_token, keys, { issuer: ISSUERS, audience: clientId })
      return toProfile(payload)
    },
  }
}
