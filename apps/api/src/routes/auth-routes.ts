import { Router } from 'express'
import type { AuthController } from '../controllers/auth-controller'
import type { AuthLimits } from '../middlewares/rate-limit'

/**
 * The routes that work without an access token (Spec, section 7). `logout`
 * needs only the cookie: whoever holds the refresh token may give it up.
 */
export function publicAuthRoutes(controller: AuthController, limits: AuthLimits): Router {
  const router = Router()

  router.post('/register', ...limits.register, controller.register)
  router.post('/login', ...limits.signIn, controller.signIn)
  router.post('/login/totp', ...limits.secondFactor, controller.signInWithCode)
  router.post('/refresh', controller.refresh)
  router.post('/logout', controller.signOut)
  router.post('/forgot-password', ...limits.forgotPassword, controller.forgotPassword)
  router.post('/reset-password', ...limits.resetPassword, controller.resetPassword)
  router.get('/google', controller.googleStart)
  router.get('/google/callback', controller.googleCallback)
  router.post('/google/exchange', controller.googleExchange)

  return router
}

/** Behind the gate: ending every session needs to know whose they are. */
export function signedInAuthRoutes(controller: AuthController): Router {
  const router = Router()
  router.post('/logout-all', controller.signOutEverywhere)
  return router
}

/** The account of the token: who it is (P2), the anonymization of RF05 and the optional second factor. */
export function meRoutes(controller: AuthController): Router {
  const router = Router()
  router.get('/', controller.me)
  router.post('/anonymize', controller.anonymize)
  router.post('/totp/setup', controller.totpSetup)
  router.post('/totp/enable', controller.totpEnable)
  router.post('/totp/disable', controller.totpDisable)
  return router
}
