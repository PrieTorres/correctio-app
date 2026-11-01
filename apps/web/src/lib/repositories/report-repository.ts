import {
  buildApplicationReport,
  consolidatedRowOf,
  consolidatedRows,
  finishedCorrections,
  isPendingCorrection,
  RECENT_ACTIVITY_LIMIT,
  type ApplicationOverview,
  type ApplicationReport,
  type ConsolidatedReportRow,
  type Correction,
  type DashboardActivity,
  type DashboardSummary,
  type Question,
  type ReportFilters,
  type ReportFormat,
} from '@correctio/domain'
import { StorageError } from '@/lib/storage/errors'
import type { ApplicationRepository } from './application-repository'
import type { ClassRepository } from './class-repository'
import type { ExamRepository } from './exam-repository'
import type { PrintingRepository } from './printing-repository'
import type { QuestionRepository } from './question-repository'
import { LARGEST_PAGE } from './read-every-page'
import type { StudentRepository } from './student-repository'

/**
 * The panel (P1) and the reports (P18, P19). On the API each is one request,
 * calculated on the server (#50); in the demo they are calculated here, with
 * the same functions of `@correctio/domain`.
 */
export interface ReportRepository {
  dashboard: () => Promise<DashboardSummary>
  application: (applicationId: string) => Promise<ApplicationReport>
  consolidated: () => Promise<ConsolidatedReportRow[]>
  /** The file of P18 in Excel, CSV or PDF (RF36), drawn by the server from the numbers the screen shows. */
  exportApplication: (applicationId: string, format: ReportFormat) => Promise<ReportFile>
  /** The file of P19, with only the rows the filters on screen let through. */
  exportConsolidated: (format: ReportFormat, filters: ReportFilters) => Promise<ReportFile>
}

/** An exported report, with the name the server gave it. */
export interface ReportFile {
  blob: Blob
  filename: string
}

/** Every correction of one application, which is how the corrections are read once they live on the API (#48). */
export interface CorrectionsByApplication {
  listByApplication: (applicationId: string) => Promise<Correction[]>
}

/** What the browser version reads: the other repositories of the teacher in this browser. */
export interface LocalReportSources {
  classes: Pick<ClassRepository, 'list' | 'getById'>
  questions: Pick<QuestionRepository, 'list' | 'getById'>
  exams: Pick<ExamRepository, 'list' | 'getById'>
  applications: Pick<ApplicationRepository, 'list' | 'getById'>
  students: Pick<StudentRepository, 'listWithRemoved'>
  printing: Pick<PrintingRepository, 'listVersions' | 'listSheets'>
  corrections: CorrectionsByApplication
}

const NOT_FOUND = 'Aplicação não encontrada.'

/** The demo has no server, and the files are drawn there, as the PDF of an application is. */
const NO_EXPORT_IN_THE_BROWSER = 'A exportação é feita pelo servidor e não existe nesta demonstração.'

function toActivity(application: ApplicationOverview): DashboardActivity {
  return { id: application.id, title: application.examTitle, detail: application.className, date: application.date }
}

const byMostRecent = (a: Pick<ApplicationOverview, 'date'>, b: Pick<ApplicationOverview, 'date'>) => b.date.localeCompare(a.date)

/**
 * The demo and the unit tests: everything is read from this browser and
 * calculated as the API would. Reading whole lists is fine here, because
 * nothing crosses the network.
 */
export function createLocalReportRepository(sources: LocalReportSources): ReportRepository {
  const activeApplications = async () => (await sources.applications.list({ pageSize: LARGEST_PAGE })).items

  async function requireApplication(applicationId: string): Promise<ApplicationOverview> {
    const application = await sources.applications.getById(applicationId)
    if (application === null) throw new StorageError(NOT_FOUND, 'not-found')
    return application
  }

  /** The questions of the exam by id, a question deleted from the bank since included. */
  async function questionsOf(ids: readonly string[]): Promise<Question[]> {
    const found = await Promise.all(ids.map((id) => sources.questions.getById(id)))
    return found.filter((question) => question !== null)
  }

  async function consolidatedRowFor(application: ApplicationOverview): Promise<ConsolidatedReportRow | null> {
    const [schoolClass, corrections] = await Promise.all([
      sources.classes.getById(application.classId),
      sources.corrections.listByApplication(application.id),
    ])
    if (schoolClass === null) return null
    const scores = finishedCorrections(corrections).map((correction) => correction.totalScore)
    return consolidatedRowOf({ application, examTitle: application.examTitle, schoolClass, scores })
  }

  return {
    async dashboard() {
      const [classes, questions, exams, applications] = await Promise.all([
        sources.classes.list({ pageSize: 1 }),
        sources.questions.list({ pageSize: 1 }),
        sources.exams.list({ pageSize: 1 }),
        activeApplications(),
      ])
      const corrections = (await Promise.all(applications.map((item) => sources.corrections.listByApplication(item.id)))).flat()
      const sorted = applications.toSorted(byMostRecent)

      return {
        classes: classes.total,
        questions: questions.total,
        exams: exams.total,
        applications: applications.length,
        pendingCorrections: corrections.filter(isPendingCorrection).length,
        recent: sorted.slice(0, RECENT_ACTIVITY_LIMIT).map(toActivity),
        gradable: sorted.filter((item) => item.status === 'generated').map(toActivity),
      }
    },

    async application(applicationId) {
      const application = await requireApplication(applicationId)
      const [exam, versions, sheets, students, corrections] = await Promise.all([
        sources.exams.getById(application.examId),
        sources.printing.listVersions(applicationId),
        sources.printing.listSheets(applicationId),
        sources.students.listWithRemoved(application.classId),
        sources.corrections.listByApplication(applicationId),
      ])
      const examQuestions = exam?.questions ?? []

      return buildApplicationReport({
        application,
        examTitle: application.examTitle,
        className: application.className,
        examQuestions,
        questions: await questionsOf(examQuestions.map((entry) => entry.questionId)),
        versions,
        sheets,
        students,
        corrections,
      })
    },

    async consolidated() {
      const rows = await Promise.all((await activeApplications()).map(consolidatedRowFor))
      return consolidatedRows(rows.filter((row) => row !== null))
    },

    exportApplication: () => Promise.reject(new StorageError(NO_EXPORT_IN_THE_BROWSER, 'not-found')),
    exportConsolidated: () => Promise.reject(new StorageError(NO_EXPORT_IN_THE_BROWSER, 'not-found')),
  }
}
