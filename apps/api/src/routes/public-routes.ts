import { Router, type RequestHandler } from 'express'
import type { Kysely } from 'kysely'
import { createPublicLookupController } from '../controllers/public-lookup-controller'
import type { Database } from '../models/tables'
import { createPublicLookupRepository } from '../repositories/public-lookup-repository'
import { createPublicLookupService } from '../services/public-lookup-service'

export interface PublicRouteDependencies {
  db: Kysely<Database>
  /** The public tier, per address, since nobody is signed in (`docs/Seguranca_e_LGPD.md`, section 4). */
  publicLimit: RequestHandler
}

/**
 * What a student reaches by scanning the QR code on their sheet (PUB1), with no
 * account. The limit counts every request, found or not: guessing codes is the
 * attack, and each guess must spend the budget.
 */
export function publicRoutes({ db, publicLimit }: PublicRouteDependencies): Router {
  const router = Router()
  router.get('/sheets/:code', publicLimit, createPublicLookupController(createPublicLookupService(createPublicLookupRepository(db))))
  return router
}
