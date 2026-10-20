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

const answerKeySchema = z.object(
  { published: z.boolean({ message: 'Informe se o gabarito fica publicado.' }) },
  { message: 'Dados inválidos.' },
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
     * and the repository checks that under lock, even for two at once.
     */
    async publishAnswerKey(teacherId, { applicationId, versionId }, body) {
      await requireApplication(applications, teacherId, applicationId)
      const { published } = parseRequest(answerKeySchema, body)

      const version = await printing.findVersion(applicationId, versionId)
      if (version === undefined) throw new ApiError(API_ERROR_CODE.NOT_FOUND, VERSION_NOT_FOUND)
      if (version.answerKeyPublished === published) return

      if (published) {
        await printing.publishAnswerKey(applicationId, versionId, now())
      } else if (!(await printing.takeBackAnswerKey(applicationId, versionId))) {
        throw new ApiError(API_ERROR_CODE.CONFLICT, GRADES_RELEASED)
      }
    },
  }
}
