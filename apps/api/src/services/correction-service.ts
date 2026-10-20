import { randomUUID } from 'node:crypto'
import {
  clampDiscursiveScore,
  CORRECTION_SOURCE,
  CORRECTION_STATUS,
  correctionStatusSchema,
  discursiveQuestionIdsOf,
  gradeObjectives,
  resolveCorrectionStatus,
  totalCorrectionScore,
  type AnswerSheet,
  type Correction,
  type DiscursiveScore,
  type MarkedAnswer,
} from '@correctio/domain'
import { z } from 'zod'
import { isDuplicateEntry } from '../db/errors'
import { API_ERROR_CODE, ApiError } from '../lib/api-error'
import { booleanParam, parseListRequest, type Page } from '../lib/pagination'
import { parseRequest } from '../lib/parse-request'
import type { ApplicationRepository } from '../repositories/application-repository'
import { CORRECTION_INDEX, type CorrectionRepository } from '../repositories/correction-repository'
import type { GradingExam, GradingQuestion, GradingRepository } from '../repositories/grading-repository'
import type { PrintingRepository } from '../repositories/printing-repository'
import { requireApplication } from './application-service'

const NOT_FOUND = 'Correção não encontrada.'
const SHEET_NOT_FOUND = 'Folha não encontrada.'
const SHEET_ALREADY_CORRECTED = 'Esta folha já tem correção. Edite a correção existente.'
const ALREADY_SENT = 'Esta correção já foi enviada.'
const DUPLICATE_STUDENT = 'Já existe uma correção deste aluno nesta versão. Verifique se duas folhas foram lidas como a mesma pessoa.'
const STUDENT_NOT_IN_CLASS = 'O aluno não é desta turma.'
const SHEET_HAS_STUDENT = 'Esta folha já traz o aluno impresso nela.'
const NOT_AN_OBJECTIVE = 'Uma das respostas não é de uma questão objetiva desta prova.'
const NOT_AN_ALTERNATIVE = 'Uma das alternativas marcadas não é da sua questão.'
const NOT_A_DISCURSIVE = 'Uma das notas não é de uma questão discursiva desta prova.'
const REPEATED_QUESTION = 'A mesma questão aparece duas vezes.'
const scoreAboveMaximum = (maximum: number) => `Uma nota de discursiva passa do valor da questão (${maximum}).`

/** No exam carries more questions than the answer card has rows; the ceiling only keeps a bad request small. */
const MAX_ENTRIES = 100

const answerSchema = z.object({ questionId: z.string().min(1), selectedAlternativeId: z.string().min(1).optional() })
const discursiveScoreSchema = z.object({ questionId: z.string().min(1), score: z.number().finite().nonnegative() })

/**
 * What the teacher decided on the review screen (P16), and nothing else. The
 * client never sends whether an answer is right, a score or a status: the
 * server works those out, and Zod drops them if they come.
 */
const reviewShape = {
  answers: z.array(answerSchema).max(MAX_ENTRIES),
  discursiveScores: z.array(discursiveScoreSchema).max(MAX_ENTRIES),
  notes: z.string().max(2000),
  studentId: z.string().min(1),
  reportedStudentName: z.string().trim().max(160),
  reportedStudentRegistration: z.string().trim().max(40),
  syncStatus: z.enum(['pending', 'synced', 'error']),
}

const createSchema = z.object(
  {
    answerSheetId: z.string({ message: 'Informe a folha.' }).min(1, 'Informe a folha.'),
    answers: reviewShape.answers.default([]),
    discursiveScores: reviewShape.discursiveScores.default([]),
    notes: reviewShape.notes.optional(),
    studentId: reviewShape.studentId.optional(),
    reportedStudentName: reviewShape.reportedStudentName.optional(),
    reportedStudentRegistration: reviewShape.reportedStudentRegistration.optional(),
    finalize: z.boolean({ message: 'Informe se a correção fica finalizada.' }),
    /** Sent by an app migrating onto this API, and kept; the site leaves both out. */
    clientCorrectionId: z.string().min(1).max(64).optional(),
    syncStatus: reviewShape.syncStatus.optional(),
  },
  { message: 'Dados inválidos.' },
)

const updateSchema = z.object(
  {
    answers: reviewShape.answers.optional(),
    discursiveScores: reviewShape.discursiveScores.optional(),
    notes: reviewShape.notes.optional(),
    studentId: reviewShape.studentId.optional(),
    reportedStudentName: reviewShape.reportedStudentName.optional(),
    reportedStudentRegistration: reviewShape.reportedStudentRegistration.optional(),
    finalize: z.boolean().optional(),
    syncStatus: reviewShape.syncStatus.optional(),
  },
  { message: 'Dados inválidos.' },
)

/** The filters of P15 and P17. */
const LIST_FILTERS = { assigned: booleanParam.optional(), status: correctionStatusSchema.optional() }

/** The ids of the request path: the application, then one of its corrections. */
export interface CorrectionPath {
  applicationId: string
  correctionId: string
}

export interface CorrectionService {
  list: (teacherId: string, applicationId: string, query: unknown) => Promise<Page<Correction>>
  get: (teacherId: string, path: CorrectionPath) => Promise<Correction>
  create: (teacherId: string, applicationId: string, body: unknown) => Promise<Correction>
  update: (teacherId: string, path: CorrectionPath, body: unknown) => Promise<Correction>
}

export interface CorrectionServiceDependencies {
  applications: ApplicationRepository
  printing: PrintingRepository
  grading: GradingRepository
  corrections: CorrectionRepository
  /** Injected so a test can tell the moment of a confirmation apart. */
  now?: () => Date
}

/** What the teacher's review boils down to for grading. */
interface Review {
  answers: readonly MarkedAnswer[]
  discursiveScores: readonly DiscursiveScore[]
  finalize: boolean
}

const invalid = (message: string) => new ApiError(API_ERROR_CODE.INVALID, message)

function requireUnique(questionIds: readonly string[]): void {
  if (new Set(questionIds).size !== questionIds.length) throw invalid(REPEATED_QUESTION)
}

/** Every answer is for a multiple-choice question of this exam, and marks one of its own alternatives. */
function checkAnswers(questions: ReadonlyMap<string, GradingQuestion>, answers: readonly MarkedAnswer[]): void {
  requireUnique(answers.map((answer) => answer.questionId))
  for (const { questionId, selectedAlternativeId } of answers) {
    const question = questions.get(questionId)
    if (question?.type !== 'objetiva') throw invalid(NOT_AN_OBJECTIVE)
    if (selectedAlternativeId !== undefined && !question.alternativeIds.has(selectedAlternativeId)) throw invalid(NOT_AN_ALTERNATIVE)
  }
}

/** Every mark is for an open-ended question of this exam and within what it is worth; rounded as the screen shows it. */
function checkDiscursiveScores(questions: ReadonlyMap<string, GradingQuestion>, scores: readonly DiscursiveScore[]): DiscursiveScore[] {
  requireUnique(scores.map((entry) => entry.questionId))
  return scores.map(({ questionId, score }) => {
    const question = questions.get(questionId)
    if (question?.type !== 'discursiva') throw invalid(NOT_A_DISCURSIVE)
    const maximum = question.maxScore ?? 0
    if (score > maximum) throw invalid(scoreAboveMaximum(maximum))
    return { questionId, score: clampDiscursiveScore(score, maximum) }
  })
}

/**
 * The grade of a review, worked out here with the same rules the screens use
 * (`@correctio/domain`), so what the client says is right or worth is never
 * taken on trust. `DONE` only when the teacher finalizes and every open-ended
 * question has a mark, zero included (RF28, RF47).
 */
function grade({ exam, questions }: GradingExam, review: Review): Pick<Correction, 'objectiveResults' | 'discursiveScores' | 'totalScore' | 'status'> {
  const byId = new Map(questions.map((question) => [question.id, question]))
  checkAnswers(byId, review.answers)
  const discursiveScores = checkDiscursiveScores(byId, review.discursiveScores)
  const { results } = gradeObjectives(exam, questions, review.answers)
  const status = review.finalize ? resolveCorrectionStatus(discursiveQuestionIdsOf(exam, questions), discursiveScores) : CORRECTION_STATUS.IN_PROGRESS
  return { objectiveResults: results, discursiveScores, totalScore: totalCorrectionScore(results, discursiveScores), status }
}

const answersOf = (correction: Correction): MarkedAnswer[] =>
  correction.objectiveResults.map(({ questionId, selectedAlternativeId }) => ({
    questionId,
    ...(selectedAlternativeId !== undefined && { selectedAlternativeId }),
  }))

/** Turns a refused insert into the conflict it means. */
function conflictOf(error: unknown): unknown {
  if (isDuplicateEntry(error, CORRECTION_INDEX.SHEET)) return new ApiError(API_ERROR_CODE.CONFLICT, SHEET_ALREADY_CORRECTED)
  if (isDuplicateEntry(error, CORRECTION_INDEX.CLIENT_ID)) return new ApiError(API_ERROR_CODE.CONFLICT, ALREADY_SENT)
  return error
}

/**
 * The corrections of an application (P15, P16 and P17). The owner is the
 * application's teacher, so every call starts from an application of the
 * teacher of the token: a correction of someone else is a 404, never a 403.
 */
export function createCorrectionService({ applications, printing, grading, corrections, now = () => new Date() }: CorrectionServiceDependencies): CorrectionService {
  async function requireSheet(applicationId: string, sheetId: string): Promise<AnswerSheet> {
    const sheet = await printing.findSheet(applicationId, sheetId)
    if (sheet === undefined) throw new ApiError(API_ERROR_CODE.NOT_FOUND, SHEET_NOT_FOUND)
    return sheet
  }

  async function requireCorrection(applicationId: string, id: string): Promise<Correction> {
    const correction = await corrections.findById(applicationId, id)
    if (correction === undefined) throw new ApiError(API_ERROR_CODE.NOT_FOUND, NOT_FOUND)
    return correction
  }

  /**
   * Who the correction is for (RF31). A sheet printed with a name is that
   * student's; one without gets the student the teacher picks, who must be
   * in the class. Either way, the same student twice on one version is a
   * conflict: two sheets were read as the same person.
   */
  async function studentOf(sheet: AnswerSheet, classId: string, requested: string | undefined, correctionId: string): Promise<Pick<Correction, 'studentId' | 'isAutomaticallyAssigned'>> {
    if (sheet.studentId !== undefined && requested !== undefined && requested !== sheet.studentId) throw invalid(SHEET_HAS_STUDENT)
    const studentId = sheet.studentId ?? requested
    if (studentId === undefined) return { isAutomaticallyAssigned: false }

    if (sheet.studentId === undefined && !(await grading.isStudentOf(classId, studentId))) throw invalid(STUDENT_NOT_IN_CLASS)
    if ((await corrections.findStudentIn(sheet.examVersionId, studentId, correctionId)) !== undefined) {
      throw new ApiError(API_ERROR_CODE.CONFLICT, DUPLICATE_STUDENT)
    }
    return { studentId, isAutomaticallyAssigned: sheet.studentId !== undefined }
  }

  return {
    async list(teacherId, applicationId, query) {
      await requireApplication(applications, teacherId, applicationId)
      const { assigned, status, page, pageSize } = parseListRequest(query, LIST_FILTERS)
      return corrections.list(applicationId, { page, pageSize, ...(assigned !== undefined && { assigned }), ...(status !== undefined && { status }) })
    },

    async get(teacherId, { applicationId, correctionId }) {
      await requireApplication(applications, teacherId, applicationId)
      return requireCorrection(applicationId, correctionId)
    },

    /** A review without a photo is `MANUAL` (RF30); the photo upload arrives with the reading of #78. */
    async create(teacherId, applicationId, body) {
      const application = await requireApplication(applications, teacherId, applicationId)
      const { answerSheetId, finalize, answers, discursiveScores, studentId, clientCorrectionId, syncStatus, ...reported } = parseRequest(createSchema, body)
      const sheet = await requireSheet(applicationId, answerSheetId)
      const id = randomUUID()

      const correction: Correction = {
        id,
        examVersionId: sheet.examVersionId,
        answerSheetId,
        ...reported,
        ...grade(await grading.examOf(application.examId), { answers, discursiveScores, finalize }),
        ...(await studentOf(sheet, application.classId, studentId, id)),
        confirmedAt: now().toISOString(),
        correctedBy: teacherId,
        clientCorrectionId: clientCorrectionId ?? randomUUID(),
        syncStatus: syncStatus ?? 'synced',
        source: CORRECTION_SOURCE.MANUAL,
      }
      await corrections.create(correction).catch((error: unknown) => {
        throw conflictOf(error)
      })
      return correction
    },

    /**
     * Merges what came with what is stored (`{ ...current, ...sent }`), so a
     * field left out is never erased, and grades the result again. Leaving
     * `finalize` out keeps the correction as finished or as open as it was.
     */
    async update(teacherId, { applicationId, correctionId }, body) {
      const application = await requireApplication(applications, teacherId, applicationId)
      const current = await requireCorrection(applicationId, correctionId)
      const { answers, discursiveScores, finalize, studentId, ...sent } = parseRequest(updateSchema, body)
      const sheet = await requireSheet(applicationId, current.answerSheetId)

      const review: Review = {
        answers: answers ?? answersOf(current),
        discursiveScores: discursiveScores ?? current.discursiveScores,
        finalize: finalize ?? current.status === CORRECTION_STATUS.DONE,
      }
      const merged: Correction = {
        ...current,
        ...sent,
        ...grade(await grading.examOf(application.examId), review),
        ...(await studentOf(sheet, application.classId, studentId ?? current.studentId, current.id)),
        confirmedAt: now().toISOString(),
        correctedBy: teacherId,
      }
      await corrections.update(merged)
      return merged
    },
  }
}
