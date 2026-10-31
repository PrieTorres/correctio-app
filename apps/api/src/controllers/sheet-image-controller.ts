import type { Request, RequestHandler } from 'express'
import { currentTeacherId } from '../middlewares/require-auth'
import type { SheetImageService } from '../services/sheet-image-service'

/** Type aliases rather than interfaces, for the same reason as in the student controller. */
type ApplicationParams = { id: string }

type ImageParams = ApplicationParams & { imageId: string }

export interface SheetImageController {
  upload: RequestHandler<ApplicationParams>
  image: RequestHandler<ImageParams>
  readFailures: RequestHandler<ApplicationParams>
}

/**
 * The photo arrives as the body itself, not as a multipart form: one photo
 * per request (P15 sends them one by one), so there is nothing to split.
 * Locally `express.raw` reads it; on Firebase the Functions runtime has
 * already read it and kept it in `rawBody`.
 */
function photoOf(req: Request<ApplicationParams>): Buffer | undefined {
  if (Buffer.isBuffer(req.body)) return req.body
  const { rawBody } = req as Request<ApplicationParams> & { rawBody?: unknown }
  return Buffer.isBuffer(rawBody) ? rawBody : undefined
}

/** The photos of an application's sheets (#47), under the application as the corrections are. */
export function createSheetImageController(service: SheetImageService): SheetImageController {
  return {
    async upload(req, res) {
      res.status(201).json(await service.upload(currentTeacherId(res), req.params.id, photoOf(req)))
    },

    /** `inline`, so the review screen shows it; `private`, since it carries a student's handwriting. */
    async image(req, res) {
      const { content, contentType } = await service.image(currentTeacherId(res), req.params.id, req.params.imageId)
      res.set('Content-Disposition', 'inline').set('Cache-Control', 'private, no-store').type(contentType).send(content)
    },

    async readFailures(req, res) {
      res.json(await service.readFailures(currentTeacherId(res), req.params.id))
    },
  }
}
