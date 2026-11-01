import type { AnswerSheet, ExamVersion } from '@correctio/domain'
import { z } from 'zod'
import { API_ERROR_CODE, ApiError } from '../lib/api-error'
import { parsePageRequest, type Page } from '../lib/pagination'
import { parseRequest } from '../lib/parse-request'
import type { ApplicationRepository } from '../repositories/application-repository'
import type { PrintingRepository } from '../repositories/printing-repository'
import { requireApplication } from './application-service'

const VERSION_NOT_FOUND = 'Versão não encontrada.'
const GRADES_RELEASED = 'Recolha as notas antes de despublicar o gabarito: a nota nunca aparece sem ele.'
const ARCHIVED_PUBLISH = 'Esta aplicação está arquivada. Restaure a aplicação antes de publicar o gabarito.'
const NOTHING_TO_PUBLISH = 'Gere a prova antes de publicar o gabarito.'

const answerKeySchema = z.object(
  { published: z.boolean({ error: 'Informe se o gabarito fica publicado.' }) },
  { error: 'Dados inválidos.' },
)

/** The ids of the request path: the application, then one of its versions. */
export interface VersionPath {
  applicationId: string
  versionId: string
}

export interface PrintingService {
  listVersions: (teacherId: string, applicationId: string, query: unknown) => Promise<Page<ExamVersion>>
  listSheets: (teacherId: string, applicationId: string, query: unknown) => Promise<Page<AnswerSheet>>
  publishAnswerKey: (teacherId: string, path: VersionPath, body: unknown) => Promise<void>
  /** "Publicar todos" on P14: every version of the application at once. */
  publishAllAnswerKeys: (teacherId: string, applicationId: string) => Promise<void>
}

export interface PrintingServiceDependencies {
  applications: ApplicationRepository
  printing: PrintingRepository
  /** Injected so a test can tell the moment of publication apart. */
  now?: () => Date
}

/**
 * The versions and sheets of an application, which only its teacher reaches:
 * every call starts from an application of the teacher of the token, and a
 * version is looked for inside it, so the id of someone else's version finds
 * nothing.
 */
export function createPrintingService({ applications, printing, now = () => new Date() }: PrintingServiceDependencies): PrintingService {
  return {
    async listVersions(teacherId, applicationId, query) {
      await requireApplication(applications, teacherId, applicationId)
      return printing.listVersions(applicationId, parsePageRequest(query))
    },

    async listSheets(teacherId, applicationId, query) {
      await requireApplication(applications, teacherId, applicationId)
      return printing.listSheets(applicationId, parsePageRequest(query))
    },

    /**
     * Publishing what is already published writes nothing, so
     * `answerKeyPublishedAt` keeps the moment the key first became public. The
     * key cannot be taken back while the grades are released: a grade never
     * shows without its key (RF46), whichever order the switches are flipped in,
     * and the repository checks that under lock, even for two at once. An
     * archived application publishes nothing until it is restored (#46), but
     * its keys can still be taken back, which only hides them.
     */
    async publishAnswerKey(teacherId, { applicationId, versionId }, body) {
      const application = await requireApplication(applications, teacherId, applicationId)
      const { published } = parseRequest(answerKeySchema, body)
      if (published && application.status === 'closed') throw new ApiError(API_ERROR_CODE.CONFLICT, ARCHIVED_PUBLISH)

      const version = await printing.findVersion(applicationId, versionId)
      if (version === undefined) throw new ApiError(API_ERROR_CODE.NOT_FOUND, VERSION_NOT_FOUND)
      if (version.answerKeyPublished === published) return

      if (published) {
        await printing.publishAnswerKey(applicationId, versionId, now())
      } else if (!(await printing.takeBackAnswerKey(applicationId, versionId))) {
        throw new ApiError(API_ERROR_CODE.CONFLICT, GRADES_RELEASED)
      }
    },

    /**
     * One request rather than one per version, so a failure in the middle
     * never leaves half of the versions published. Taking the keys back stays
     * version by version, as P14 offers it.
     */
    async publishAllAnswerKeys(teacherId, applicationId) {
      const application = await requireApplication(applications, teacherId, applicationId)
      if (application.status === 'closed') throw new ApiError(API_ERROR_CODE.CONFLICT, ARCHIVED_PUBLISH)

      const { total } = await printing.listVersions(applicationId, { page: 1, pageSize: 1 })
      if (total === 0) throw new ApiError(API_ERROR_CODE.CONFLICT, NOTHING_TO_PUBLISH)
      await printing.publishAllAnswerKeys(applicationId, now())
    },
  }
}
