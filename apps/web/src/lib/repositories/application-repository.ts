import {
  CORRECTION_STATUS,
  type AnswerSheet,
  type Application,
  type ApplicationOverview,
  type ApplicationStatus,
  type CorrectionProgress,
  type ExamVersion,
} from '@/types/domain'
import type { ApplicationInput, GenerationRequest } from '@/lib/schemas'
import { applicationSchema } from '@/lib/schemas'
import { buildAnswerSheets, buildVersions, canRegenerate, correctionProgressOf } from '@/lib/applications'
import { createCollection, simulateLatency } from '@/lib/storage/collection'
import { StorageError } from '@/lib/storage/errors'
import { formatDate } from '@/lib/utils'
import type { ClassRepository } from './class-repository'
import type { CorrectionRepository } from './correction-repository'
import { archiveByStatus, createOwnedRepository } from './create-owned-repository'
import type { LocalExamRepository } from './exam-repository'
import type { LocalPrintingRepository } from './printing-repository'
import type { QuestionRepository } from './question-repository'
import type { StudentRepository } from './student-repository'
import type { ListParams, OwnedRepository } from './types'

/** The filters of P11 on top of the shared list parameters, with the names the API reads. */
export interface ApplicationListParams extends ListParams {
  classId?: string
  examId?: string
  status?: ApplicationStatus
  correction?: CorrectionProgress
}

/** What a generation printed: the versions and the sheets the PDF carries. */
export interface GeneratedPaper {
  versions: ExamVersion[]
  sheets: AnswerSheet[]
}

/** The PDF of an application as a file to save, with the name the server gave it. */
export interface ApplicationPdf {
  blob: Blob
  filename: string
}

/**
 * Applications as the screens read them, with their overview: the exam, the
 * class and how far each one has gone, which the API counts for a whole page
 * at once (`ApplicationOverview`).
 *
 * Three operations the form cannot express, because none of them is something
 * the teacher types: printing, letting the students see their grades, and
 * handing the PDF over. No screen builds versions or sheets any more: the
 * generation hands back what it printed.
 */
export interface ApplicationRepository extends OwnedRepository<ApplicationOverview, ApplicationInput, ApplicationListParams> {
  /** Prints the application again from scratch: new versions, new sheets with new codes, and a new PDF (RF22 to RF24). */
  generate: (id: string, request: GenerationRequest) => Promise<GeneratedPaper>
  setGradesReleased: (id: string, released: boolean) => Promise<ApplicationOverview>
  downloadPdf: (id: string) => Promise<ApplicationPdf>
}

/** What the browser version reads beyond its own records: the other repositories of the teacher in this browser. */
export interface LocalApplicationSources {
  exams: Pick<LocalExamRepository, 'getById' | 'markReady'>
  classes: Pick<ClassRepository, 'getById'>
  questions: Pick<QuestionRepository, 'list'>
  students: Pick<StudentRepository, 'listByClass'>
  printing: LocalPrintingRepository
  corrections: Pick<CorrectionRepository, 'listByApplication'>
}

const NOT_FOUND = 'Aplicação não encontrada.'
const EXAM_NOT_FOUND = 'Prova não encontrada.'

/** The demo has no server, and the PDF is drawn there. */
const NO_PDF_IN_THE_BROWSER = 'O PDF é montado pelo servidor e não existe nesta demonstração.'

/** Every application the filters let through, for a list paged only after the correction stage is known. */
const EVERY_MATCH = Number.MAX_SAFE_INTEGER

/**
 * The browser version of the applications, for the GitHub Pages demo and the
 * unit tests. It answers what the API answers, computing the overview from
 * the other repositories, and prints the paper in this browser.
 *
 * Restoring returns an application to `draft`, never to `generated`:
 * `generated` says paper exists, which archiving does not undo, and bringing
 * one back as generated would promise sheets that may no longer match the exam.
 *
 * Sorted and searched by date, the most recent first, as the API lists them:
 * an application is an event, and what a teacher looks for is the one from a
 * given day, typed as the screen prints it ("05/10/2026") or as ISO.
 */
export function createLocalApplicationRepository(
  teacherId: string,
  sources: LocalApplicationSources,
): ApplicationRepository {
  const collection = createCollection('applications', applicationSchema)

  const base = createOwnedRepository<Application, ApplicationInput, ApplicationListParams>({
    collection,
    teacherId,
    label: 'Aplicação',
    archiving: archiveByStatus<Application>('draft', 'closed'),
    toEntity: (input, identity) => ({
      ...identity,
      ...input,
      status: 'draft',
      gradesReleased: false,
    }),
    searchableFields: (item) => [item.date, formatDate(item.date)],
    sortKey: (item) => item.date,
    sortDirection: 'desc',
    /** The same exam, to the same class, on the same day is one sitting. */
    identity: (item) => `${item.examId}|${item.classId}|${item.date.slice(0, 10)}`,
    extraFilters: (item, { classId, examId, status }) =>
      (classId === undefined || item.classId === classId) &&
      (examId === undefined || item.examId === examId) &&
      (status === undefined || item.status === status),
  })

  async function correctionsOf(applicationId: string) {
    const sheets = await sources.printing.listSheets(applicationId)
    return { sheets, corrections: await sources.corrections.listByApplication(applicationId) }
  }

  async function overviewOf(application: Application): Promise<ApplicationOverview> {
    const [exam, group, versions, { sheets, corrections }] = await Promise.all([
      sources.exams.getById(application.examId),
      sources.classes.getById(application.classId),
      sources.printing.listVersions(application.id),
      correctionsOf(application.id),
    ])

    return {
      ...application,
      examTitle: exam?.title ?? '',
      className: group?.name ?? '',
      progress: {
        versions: versions.length,
        publishedAnswerKeys: versions.filter((version) => version.answerKeyPublished).length,
        sheets: sheets.length,
        correctedSheets: corrections.filter((correction) => correction.status === CORRECTION_STATUS.DONE).length,
        corrections: corrections.length,
      },
    }
  }

  async function requireApplication(id: string): Promise<Application> {
    const found = await base.getById(id)
    if (found === null) throw new StorageError(NOT_FOUND, 'not-found')
    return found
  }

  /** Returns what was stored, so a caller can refresh its cache without reading again. */
  const change = (id: string, transform: (application: Application) => Application): Application => {
    const all = collection.readAll()
    const index = all.findIndex((item) => item.id === id && item.teacherId === teacherId)
    const application = all[index]
    if (application === undefined) throw new StorageError(NOT_FOUND, 'not-found')

    const next = transform(application)
    collection.writeAll(all.with(index, next))
    return next
  }

  /** The same refusal the API makes under lock, so the demo never prints over corrected sheets. */
  async function refuseRegenerating(application: Application): Promise<void> {
    const { corrections } = await correctionsOf(application.id)
    const verdict = canRegenerate(application, corrections.length)
    if (!verdict.allowed) throw new StorageError(verdict.reason, 'conflict')
  }

  async function printPaper(application: Application, request: GenerationRequest): Promise<GeneratedPaper> {
    const exam = await sources.exams.getById(application.examId)
    if (exam === null) throw new StorageError(EXAM_NOT_FOUND, 'not-found')

    const [bank, students] = await Promise.all([
      sources.questions.list({ pageSize: 1000 }),
      sources.students.listByClass(application.classId),
    ])
    const versions = buildVersions({
      applicationId: application.id,
      exam,
      questions: bank.items,
      versions: request.versions,
      withStudentIdentification: request.withStudentIdentification,
    })
    return { versions, sheets: buildAnswerSheets(application.id, versions, students, request.withStudentIdentification) }
  }

  return {
    async list(params = {}) {
      const { page = 1, pageSize = 50, correction, ...filters } = params
      const matches = await base.list({ ...filters, page: 1, pageSize: EVERY_MATCH })
      const overviews = await Promise.all(matches.items.map(overviewOf))
      const inStage =
        correction === undefined ? overviews : overviews.filter((item) => correctionProgressOf(item.progress) === correction)

      const start = (page - 1) * pageSize
      return { items: inStage.slice(start, start + pageSize), total: inStage.length }
    },

    async getById(id) {
      const found = await base.getById(id)
      return found === null ? null : overviewOf(found)
    },

    async create(input) {
      return overviewOf(await base.create(input))
    },

    async update(id, input) {
      return overviewOf(await base.update(id, input))
    },

    archive: base.archive,
    restore: base.restore,

    /**
     * Regenerating replaces both the versions and the sheets, so the exam
     * becomes `ready` and the application `generated`, as the API marks them.
     */
    async generate(id, request) {
      const application = await requireApplication(id)
      await refuseRegenerating(application)

      const paper = await printPaper(application, request)
      await sources.printing.replaceForApplication(id, paper.versions, paper.sheets)
      change(id, (item) => ({ ...item, status: 'generated' }))
      await sources.exams.markReady(application.examId)
      return paper
    },

    async setGradesReleased(id, released) {
      await simulateLatency()
      return overviewOf(change(id, (application) => ({ ...application, gradesReleased: released })))
    },

    async downloadPdf() {
      await simulateLatency()
      throw new StorageError(NO_PDF_IN_THE_BROWSER, 'not-found')
    },
  }
}
