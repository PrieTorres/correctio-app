import { applicationStatusSchema, type Application } from '@correctio/domain'
import { z } from 'zod'
import { API_ERROR_CODE, ApiError } from '../lib/api-error'
import type { FileStorage } from '../lib/file-storage'
import { parseListRequest, type Page } from '../lib/pagination'
import { parseRequest } from '../lib/parse-request'
import type { ApplicationRepository, StoredApplication } from '../repositories/application-repository'

const NOT_FOUND = 'Aplicação não encontrada.'
const NO_PDF = 'O PDF desta aplicação ainda não foi gerado.'
const PDF_FILE_MISSING = 'O arquivo do PDF não foi encontrado. Gere a prova de novo.'
const NOTHING_GENERATED = 'Gere a prova antes de liberar as notas.'
const ANSWER_KEY_PENDING = 'Publique o gabarito de todas as versões antes de liberar as notas.'

/** The filters of P11. An id of something the teacher does not own simply matches nothing. */
const LIST_FILTERS = {
  classId: z.string().min(1).optional(),
  examId: z.string().min(1).optional(),
  status: applicationStatusSchema.optional(),
}

const gradesReleaseSchema = z.object(
  { released: z.boolean({ message: 'Informe se as notas ficam liberadas.' }) },
  { message: 'Dados inválidos.' },
)

/** The PDF of an application, ready to be sent as a download. */
export interface ApplicationPdf {
  filename: string
  content: Buffer
}

export interface ApplicationService {
  list: (teacherId: string, query: unknown) => Promise<Page<Application>>
  get: (teacherId: string, id: string) => Promise<Application>
  archive: (teacherId: string, id: string) => Promise<void>
  restore: (teacherId: string, id: string) => Promise<void>
  releaseGrades: (teacherId: string, id: string, body: unknown) => Promise<Application>
  downloadPdf: (teacherId: string, id: string) => Promise<ApplicationPdf>
}

export interface ApplicationServiceDependencies {
  applications: ApplicationRepository
  fileStorage: FileStorage
}

/**
 * Where the API serves the PDF, relative to its root. It is what `pdfUrl`
 * means to a client: the file is private, so it is downloaded with the
 * teacher's token rather than from an address anyone holding it could open.
 */
export function applicationPdfPath(id: string): string {
  return `/applications/${id}/pdf`
}

/** The application as the contract shows it: `pdfUrl` only when there is a PDF to download. */
function present({ pdfKey, ...application }: StoredApplication): Application {
  return pdfKey === undefined ? application : { ...application, pdfUrl: applicationPdfPath(application.id) }
}

/** The application of the teacher, or the 404 that never tells another teacher it exists. */
export async function requireApplication(
  repository: ApplicationRepository,
  teacherId: string,
  id: string,
): Promise<StoredApplication> {
  const application = await repository.findById(teacherId, id)
  if (application === undefined) throw new ApiError(API_ERROR_CODE.NOT_FOUND, NOT_FOUND)
  return application
}

/**
 * What stops the release of grades, if anything. A grade never shows without
 * the answer key (RF46, `docs/Seguranca_e_LGPD.md`, section 3), so every printed
 * version needs its key published, and an application with nothing printed
 * has no key at all.
 */
function releaseBlocker(answerKeysPublished: readonly boolean[]): string | undefined {
  if (answerKeysPublished.length === 0) return NOTHING_GENERATED
  return answerKeysPublished.every(Boolean) ? undefined : ANSWER_KEY_PENDING
}

/**
 * The application itself: listing, archiving, releasing grades and handing
 * out the PDF. Creating, editing and generating read the exam, so they come
 * with the exams of #45.
 */
export function createApplicationService({ applications, fileStorage }: ApplicationServiceDependencies): ApplicationService {
  return {
    async list(teacherId, query) {
      const page = await applications.list(teacherId, parseListRequest(query, LIST_FILTERS))
      return { items: page.items.map(present), total: page.total }
    },

    async get(teacherId, id) {
      return present(await requireApplication(applications, teacherId, id))
    },

    async archive(teacherId, id) {
      await requireApplication(applications, teacherId, id)
      await applications.setStatus(teacherId, id, 'closed')
    },

    /**
     * An archived application comes back as `draft`, never as `generated`:
     * archiving does not undo the paper, but the sheets may no longer match
     * the exam, as in the web app. One that is not archived stays as it is, so
     * a repeated click never turns a `generated` application into a draft.
     */
    async restore(teacherId, id) {
      const { status } = await requireApplication(applications, teacherId, id)
      if (status === 'closed') await applications.setStatus(teacherId, id, 'draft')
    },

    /**
     * Taking grades back is always allowed; releasing them waits for the
     * answer keys, which the repository checks under lock so a key taken back
     * at the same moment cannot slip through.
     */
    async releaseGrades(teacherId, id, body) {
      const current = await requireApplication(applications, teacherId, id)
      const { released } = parseRequest(gradesReleaseSchema, body)

      if (released) {
        const blocker = await applications.releaseGrades(teacherId, id, releaseBlocker)
        if (blocker !== undefined) throw new ApiError(API_ERROR_CODE.CONFLICT, blocker)
      } else {
        await applications.withdrawGrades(teacherId, id)
      }
      return present({ ...current, gradesReleased: released })
    },

    /**
     * The PDF is read through the API, never through a public address, since it
     * carries the names of the students when the application identifies them. A
     * key the storage no longer holds is a failure of the server, logged as one,
     * not a PDF that was never made.
     */
    async downloadPdf(teacherId, id) {
      const { pdfKey, date } = await requireApplication(applications, teacherId, id)
      if (pdfKey === undefined) throw new ApiError(API_ERROR_CODE.NOT_FOUND, NO_PDF)

      const content = await fileStorage.read(pdfKey)
      if (content === null) throw new ApiError(API_ERROR_CODE.FAILURE, PDF_FILE_MISSING)
      return { filename: `prova-${date.slice(0, 10)}.pdf`, content }
    },
  }
}
