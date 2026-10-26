import { randomUUID } from 'node:crypto'
import {
  buildAnswerSheets,
  buildVersions,
  canRegenerate,
  generationRequestSchema,
  type AnswerSheet,
  type Class,
  type Exam,
  type ExamVersion,
  type GenerationRequest,
} from '@correctio/domain'
import type { Logger } from 'pino'
import { API_ERROR_CODE, ApiError } from '../lib/api-error'
import { QuestionTooTallError, renderExamPdf, type PrintedQuestion, type PrintedSheet, type PrintJob } from '../lib/exam-pdf'
import type { FileStorage } from '../lib/file-storage'
import { parseRequest } from '../lib/parse-request'
import type { ApplicationRepository, StoredApplication } from '../repositories/application-repository'
import type { ClassRepository } from '../repositories/class-repository'
import type { GenerationBlocker, PrintingRepository, SheetHolder } from '../repositories/printing-repository'
import type { QuestionRecord, QuestionRepository } from '../repositories/question-repository'
import { requireApplication } from './application-service'
import type { ExamService } from './exam-service'

const CLASS_NOT_FOUND = 'Turma não encontrada.'
const EMPTY_EXAM = 'A prova não tem questões. Monte a prova antes de gerar.'
const NO_STUDENTS = 'A turma não tem alunos ativos para receber as folhas. Cadastre os alunos antes de gerar.'

function questionTooTall(number: number): string {
  return `A questão ${number} da prova não cabe numa página impressa. Encurte o enunciado ou divida a questão em duas.`
}

/** What a generation answers: the versions and sheets it printed, the same ones the PDF carries. */
export interface GeneratedPaper {
  versions: ExamVersion[]
  sheets: AnswerSheet[]
}

export interface GenerationService {
  generate: (teacherId: string, applicationId: string, body: unknown) => Promise<GeneratedPaper>
}

export interface GenerationServiceDependencies {
  applications: ApplicationRepository
  printing: PrintingRepository
  /** The exam is read through its service, with its questions in order, and marked `ready` there once applied. */
  exams: Pick<ExamService, 'get' | 'markReady'>
  classes: Pick<ClassRepository, 'findById'>
  questions: Pick<QuestionRepository, 'findByIds'>
  fileStorage: FileStorage
  /** The origin of the web app, which the QR code of every sheet points at (`PUBLIC_APP_URL`). */
  publicAppUrl: string
  /** Where the steps after the commit report a failure, since by then the paper is already replaced. */
  logger: Logger
}

/** Everything the paper is made from, read before anything is written. */
interface Sources {
  application: StoredApplication
  exam: Exam
  group: Class
  questions: QuestionRecord[]
  students: SheetHolder[]
}

/** The rule of the domain, which the screen also shows, asked again by the repository under lock. */
const regenerationBlocker: GenerationBlocker = ({ application, corrections }) => {
  const verdict = canRegenerate(application, corrections)
  return verdict.allowed ? undefined : verdict.reason
}

function refuse(reason: string | undefined): void {
  if (reason !== undefined) throw new ApiError(API_ERROR_CODE.CONFLICT, reason)
}

/** Where the teacher sees a question: its place in the exam, counted from one. */
function numberInExam(exam: Exam, questionId: string): number {
  const ordered = exam.questions.toSorted((a, b) => a.order - b.order)
  return ordered.findIndex((entry) => entry.questionId === questionId) + 1
}

function paperOf({ application, exam, questions, students }: Sources, request: GenerationRequest): GeneratedPaper {
  const versions = buildVersions({
    applicationId: application.id,
    exam,
    questions,
    versions: request.versions,
    withStudentIdentification: request.withStudentIdentification,
  })
  return { versions, sheets: buildAnswerSheets(application.id, versions, students, request.withStudentIdentification) }
}

/** The questions the PDF prints, each with what it is worth in this exam. */
function printedQuestions(exam: Exam, questions: readonly QuestionRecord[]): Map<string, PrintedQuestion> {
  const byId = new Map(questions.map((question) => [question.id, question]))
  const printed = new Map<string, PrintedQuestion>()
  for (const { questionId, score } of exam.questions) {
    const question = byId.get(questionId)
    if (question !== undefined) printed.set(questionId, { question, score })
  }
  return printed
}

/** A sheet with its student only when it names one, which happens only when the application identifies the students. */
function printedSheets(sheets: readonly AnswerSheet[], students: readonly SheetHolder[]): PrintedSheet[] {
  const byId = new Map(students.map((student) => [student.id, student]))
  return sheets.map((sheet) => {
    const holder = sheet.studentId === undefined ? undefined : byId.get(sheet.studentId)
    return holder === undefined ? { sheet } : { sheet, student: { fullName: holder.fullName, registration: holder.registration } }
  })
}

function printJobOf(sources: Sources, paper: GeneratedPaper, publicAppUrl: string): PrintJob {
  const { application, exam, group, questions, students } = sources
  return {
    examTitle: exam.title,
    className: group.name,
    subject: group.subject,
    term: group.term,
    date: application.date,
    publicAppUrl,
    versions: paper.versions,
    questions: printedQuestions(exam, questions),
    sheets: printedSheets(paper.sheets, students),
  }
}

/**
 * Generating an application (RF22 to RF24, RF43 and RF44): its versions and
 * one sheet per student, with codes made here and never by a client, and the
 * PDF of all of them.
 *
 * Everything is read and the PDF drawn and stored before any row changes, so
 * the transaction that swaps the paper stays short and the application never
 * points at a file that does not exist. The rule of regenerating is asked
 * first, to spare the drawing of a refused generation, and again under lock,
 * where it counts. What comes after the commit, removing the PDF replaced and
 * marking the exam `ready`, cannot undo the paper, so a failure there is
 * logged instead of answered.
 */
export function createGenerationService(deps: GenerationServiceDependencies): GenerationService {
  const { applications, printing, exams, classes, questions, fileStorage, publicAppUrl, logger } = deps

  /** A file that could not be removed only takes space, so the failure is logged rather than answered. */
  async function removeQuietly(key: string): Promise<void> {
    await fileStorage.remove(key).catch((error: unknown) => {
      logger.error({ err: error, key }, 'A PDF no application points at was not removed')
    })
  }

  async function readSources(teacherId: string, application: StoredApplication): Promise<Sources> {
    const [exam, group, students] = await Promise.all([
      exams.get(teacherId, application.examId),
      classes.findById(teacherId, application.classId),
      printing.sheetHolders(application.classId),
    ])
    if (group === undefined) throw new ApiError(API_ERROR_CODE.NOT_FOUND, CLASS_NOT_FOUND)
    if (exam.questions.length === 0) throw new ApiError(API_ERROR_CODE.CONFLICT, EMPTY_EXAM)
    if (students.length === 0) throw new ApiError(API_ERROR_CODE.CONFLICT, NO_STUDENTS)

    const records = await questions.findByIds(teacherId, exam.questions.map((entry) => entry.questionId))
    return { application, exam, group, questions: records, students }
  }

  /** Draws the PDF; a question too tall for a page is named by its place in the exam, as the teacher numbers it. */
  async function render(sources: Sources, paper: GeneratedPaper): Promise<Buffer> {
    try {
      return await renderExamPdf(printJobOf(sources, paper, publicAppUrl))
    } catch (error) {
      if (!(error instanceof QuestionTooTallError)) throw error
      throw new ApiError(API_ERROR_CODE.CONFLICT, questionTooTall(numberInExam(sources.exam, error.questionId)), { cause: error })
    }
  }

  /** Swaps the paper, and removes the new PDF again if nothing ends up pointing at it. */
  async function swap(applicationId: string, paper: GeneratedPaper, pdfKey: string): Promise<string | undefined> {
    const outcome = await printing.replacePaper(applicationId, { ...paper, pdfKey }, regenerationBlocker).catch(async (error: unknown) => {
      await removeQuietly(pdfKey)
      throw error
    })
    if (outcome.kind === 'REPLACED') return outcome.previousPdfKey

    await removeQuietly(pdfKey)
    throw new ApiError(API_ERROR_CODE.CONFLICT, outcome.reason)
  }

  async function markReadyQuietly(teacherId: string, examId: string): Promise<void> {
    await exams.markReady(teacherId, examId).catch((error: unknown) => {
      logger.error({ err: error, examId }, 'The exam was not marked ready after its application was generated')
    })
  }

  return {
    async generate(teacherId, applicationId, body) {
      const application = await requireApplication(applications, teacherId, applicationId)
      const request = parseRequest(generationRequestSchema, body)
      refuse(regenerationBlocker({ application, corrections: await printing.correctionsOf(applicationId) }))

      const sources = await readSources(teacherId, application)
      const paper = paperOf(sources, request)
      const pdfKey = `applications/${applicationId}/${randomUUID()}.pdf`
      await fileStorage.save(pdfKey, await render(sources, paper), 'application/pdf')

      const previousPdfKey = await swap(applicationId, paper, pdfKey)
      if (previousPdfKey !== undefined) await removeQuietly(previousPdfKey)
      await markReadyQuietly(teacherId, sources.exam.id)
      return paper
    },
  }
}
