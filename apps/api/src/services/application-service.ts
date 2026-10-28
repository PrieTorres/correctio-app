import { randomUUID } from 'node:crypto'
import {
  applicationInputSchema,
  applicationStatusSchema,
  correctionProgressSchema,
  type Application,
  type ApplicationInput,
  type ApplicationOverview,
  type ApplicationStatus,
} from '@correctio/domain'
import { z } from 'zod'
import { API_ERROR_CODE, ApiError } from '../lib/api-error'
import type { FileStorage } from '../lib/file-storage'
import { mergePatch } from '../lib/merge-patch'
import { parseListRequest, type Page } from '../lib/pagination'
import { parseRequest } from '../lib/parse-request'
import type {
  ApplicationClash,
  ApplicationRepository,
  Sitting,
  SittingBlocker,
  StoredApplication,
} from '../repositories/application-repository'
import type { ClassRepository } from '../repositories/class-repository'
import type { ExamRepository } from '../repositories/exam-repository'

const NOT_FOUND = 'Aplicação não encontrada.'
const NO_PDF = 'O PDF desta aplicação ainda não foi gerado.'
const PDF_FILE_MISSING = 'O arquivo do PDF não foi encontrado. Gere a prova de novo.'
const NOTHING_GENERATED = 'Gere a prova antes de liberar as notas.'
const ANSWER_KEY_PENDING = 'Publique o gabarito de todas as versões antes de liberar as notas.'
const CLOSED_OUTSIDE_ARCHIVED = 'A situação closed só existe entre as aplicações arquivadas: use archived=true.'
const ACTIVE_STATUS_IN_ARCHIVED = 'Entre as aplicações arquivadas, a única situação é closed.'

const EXAM_NOT_FOUND = 'Prova não encontrada.'
const CLASS_NOT_FOUND = 'Turma não encontrada.'
const EXAM_ARCHIVED = 'Esta prova está arquivada. Restaure a prova antes de aplicá-la.'
const CLASS_ARCHIVED = 'Esta turma está arquivada. Restaure a turma antes de aplicar uma prova a ela.'

/** The same messages the web app shows today (`requireUnique` in `create-owned-repository.ts`). */
const DUPLICATE = 'Já existe uma aplicação com estes dados.'
const DUPLICATE_ARCHIVED = 'Já existe uma aplicação arquivada com estes dados. Restaure em vez de criar outra.'

const ARCHIVED_EDIT = 'Esta aplicação está arquivada. Restaure a aplicação antes de editá-la.'
const ARCHIVED_RELEASE = 'Esta aplicação está arquivada. Restaure a aplicação antes de liberar as notas.'
const PAPER_BELONGS_TO_SITTING =
  'Esta aplicação já foi gerada, e as folhas impressas são desta prova e desta turma. Para mudar uma delas, crie outra aplicação.'

/** The fields of the application form; the rest of an `Application` is decided by the server. */
const SITTING_FIELDS = ['examId', 'classId', 'date'] as const satisfies readonly (keyof ApplicationInput)[]

/** The filters of P11. An id of something the teacher does not own simply matches nothing. */
const LIST_FILTERS = {
  classId: z.string().min(1).optional(),
  examId: z.string().min(1).optional(),
  status: applicationStatusSchema.optional(),
  correction: correctionProgressSchema.optional(),
}

/**
 * `archived` chooses between the active applications and the archived ones,
 * and each status lives on one side only: `closed` among the archived, `draft`
 * and `generated` among the active. Asking for a status on the other side used
 * to answer an empty list, which reads as "there is none" rather than as a
 * question that cannot match, so it is refused instead.
 */
function refuseStatusOutsideItsList({ archived, status }: { archived: boolean; status?: ApplicationStatus }): void {
  if (status === undefined || (status === 'closed') === archived) return
  throw new ApiError(API_ERROR_CODE.INVALID, archived ? ACTIVE_STATUS_IN_ARCHIVED : CLOSED_OUTSIDE_ARCHIVED)
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

/**
 * Every answer that carries an application carries its overview: the screens
 * keep one shape per application in their cache, and an answer without the
 * names and the progress would blank them until the next read.
 */
export interface ApplicationService {
  list: (teacherId: string, query: unknown) => Promise<Page<ApplicationOverview>>
  get: (teacherId: string, id: string) => Promise<ApplicationOverview>
  create: (teacherId: string, body: unknown) => Promise<ApplicationOverview>
  update: (teacherId: string, id: string, body: unknown) => Promise<ApplicationOverview>
  archive: (teacherId: string, id: string) => Promise<void>
  restore: (teacherId: string, id: string) => Promise<void>
  releaseGrades: (teacherId: string, id: string, body: unknown) => Promise<ApplicationOverview>
  downloadPdf: (teacherId: string, id: string) => Promise<ApplicationPdf>
}

export interface ApplicationServiceDependencies {
  applications: ApplicationRepository
  /** Where the exam of a new sitting is checked: the teacher's, and not archived. */
  exams: Pick<ExamRepository, 'findById'>
  classes: Pick<ClassRepository, 'findById'>
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
function present<Stored extends StoredApplication>({ pdfKey, ...application }: Stored): Omit<Stored, 'pdfKey'> & Pick<Application, 'pdfUrl'> {
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

/** The day as the database gives it back, whatever form of ISO 8601 the client sent. */
function canonical(date: string): string {
  return new Date(date).toISOString()
}

function pickSitting(application: Sitting): Sitting {
  return { examId: application.examId, classId: application.classId, date: application.date }
}

/** An archived twin is not free either, and the message points at restoring it instead. */
function clashMessage(clash: ApplicationClash | undefined): string | undefined {
  if (clash === undefined) return undefined
  return clash.status === 'closed' ? DUPLICATE_ARCHIVED : DUPLICATE
}

const newSittingBlocker: SittingBlocker = ({ clash }) => clashMessage(clash)

/**
 * After printing, only the date of a sitting may move: the sheets were made
 * for that exam and the students of that class, and corrections would be read
 * against them. A date moved keeps the paper valid, and the PDF shows the new
 * one once generated again.
 */
function editBlocker(movesPaper: boolean): SittingBlocker {
  return ({ clash, printed }) => (movesPaper && printed ? PAPER_BELONGS_TO_SITTING : clashMessage(clash))
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
 * The application itself: listing, creating, editing, archiving, releasing
 * grades and handing out the PDF. The owner comes from the token, `status`
 * starts `draft` and only the generation, archive and restore change it, and
 * the exam and the class of a sitting are checked here, not only on screen.
 */
export function createApplicationService({ applications, exams, classes, fileStorage }: ApplicationServiceDependencies): ApplicationService {
  /** The exam of a new sitting: the teacher's (404 otherwise), and not archived, since an archived exam takes no new application (RF20). */
  async function requireApplicableExam(teacherId: string, examId: string): Promise<void> {
    const exam = await exams.findById(teacherId, examId)
    if (exam === undefined) throw new ApiError(API_ERROR_CODE.NOT_FOUND, EXAM_NOT_FOUND)
    if (exam.status === 'closed') throw new ApiError(API_ERROR_CODE.CONFLICT, EXAM_ARCHIVED)
  }

  async function requireActiveClass(teacherId: string, classId: string): Promise<void> {
    const group = await classes.findById(teacherId, classId)
    if (group === undefined) throw new ApiError(API_ERROR_CODE.NOT_FOUND, CLASS_NOT_FOUND)
    if (group.status === 'archived') throw new ApiError(API_ERROR_CODE.CONFLICT, CLASS_ARCHIVED)
  }

  /**
   * Only what an edit changes is checked: an exam or a class archived after
   * the application was created still lets its date move, since archiving
   * does not affect the applications that exist (RF20).
   */
  async function requireChangedParts(teacherId: string, current: Sitting, next: Sitting): Promise<void> {
    if (next.examId !== current.examId) await requireApplicableExam(teacherId, next.examId)
    if (next.classId !== current.classId) await requireActiveClass(teacherId, next.classId)
  }

  /** The application of the teacher with its overview, read after a write so the answer says what is stored now. */
  async function overview(teacherId: string, id: string): Promise<ApplicationOverview> {
    const found = await applications.findOverview(teacherId, id)
    if (found === undefined) throw new ApiError(API_ERROR_CODE.NOT_FOUND, NOT_FOUND)
    return present(found)
  }

  return {
    async list(teacherId, query) {
      const filters = parseListRequest(query, LIST_FILTERS)
      refuseStatusOutsideItsList(filters)
      const page = await applications.list(teacherId, filters)
      return { items: page.items.map(present), total: page.total }
    },

    async get(teacherId, id) {
      return overview(teacherId, id)
    },

    async create(teacherId, body) {
      const input = parseRequest(applicationInputSchema, body)
      await requireApplicableExam(teacherId, input.examId)
      await requireActiveClass(teacherId, input.classId)

      const application: StoredApplication = {
        id: randomUUID(),
        teacherId,
        ...input,
        date: canonical(input.date),
        status: 'draft',
        gradesReleased: false,
      }
      const blocker = await applications.insert(application, newSittingBlocker)
      if (blocker !== undefined) throw new ApiError(API_ERROR_CODE.CONFLICT, blocker)
      return overview(teacherId, application.id)
    },

    /** A merge with what is stored (`null` clears a field, which the form then refuses), written column by column. */
    async update(teacherId, id, body) {
      const current = await requireApplication(applications, teacherId, id)
      if (current.status === 'closed') throw new ApiError(API_ERROR_CODE.CONFLICT, ARCHIVED_EDIT)

      const { merged, sent } = mergePatch(pickSitting(current), body, SITTING_FIELDS)
      const input = parseRequest(applicationInputSchema, merged)
      const sitting: Sitting = { ...input, date: canonical(input.date) }
      await requireChangedParts(teacherId, current, sitting)
      if (sent.length === 0) return overview(teacherId, id)

      const changes: Partial<Sitting> = {}
      for (const field of sent) Object.assign(changes, { [field]: sitting[field] })
      const movesPaper = sitting.examId !== current.examId || sitting.classId !== current.classId
      const blocker = await applications.changeSitting(teacherId, id, { sitting, changes }, editBlocker(movesPaper))
      if (blocker !== undefined) throw new ApiError(API_ERROR_CODE.CONFLICT, blocker)
      return overview(teacherId, id)
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
     * Taking grades back is always allowed, since it only hides them again;
     * releasing them waits for the answer keys, which the repository checks
     * under lock so a key taken back at the same moment cannot slip through.
     * An archived application releases nothing until it is restored, like
     * every other write that shows students something (#46).
     */
    async releaseGrades(teacherId, id, body) {
      const current = await requireApplication(applications, teacherId, id)
      const { released } = parseRequest(gradesReleaseSchema, body)

      if (released) {
        if (current.status === 'closed') throw new ApiError(API_ERROR_CODE.CONFLICT, ARCHIVED_RELEASE)
        const blocker = await applications.releaseGrades(teacherId, id, releaseBlocker)
        if (blocker !== undefined) throw new ApiError(API_ERROR_CODE.CONFLICT, blocker)
      } else {
        await applications.withdrawGrades(teacherId, id)
      }
      return overview(teacherId, id)
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
