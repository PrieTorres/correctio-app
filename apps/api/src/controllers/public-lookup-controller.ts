import type { RequestHandler } from 'express'
import type { PublicLookupService } from '../services/public-lookup-service'

type SheetParams = { code: string }

/**
 * `noindex` because this answer carries a name and a grade, and a search engine
 * that followed a code would publish them (`docs/Correctio_Requisitos_e_Telas.md`,
 * section 6.1). `Cache-Control: no-store` is already set for every route.
 */
export function createPublicLookupController(service: PublicLookupService): RequestHandler<SheetParams> {
  return async (req, res) => {
    res.set('X-Robots-Tag', 'noindex, nofollow')
    res.json(await service.lookup(req.params.code))
  }
}
