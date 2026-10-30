import {
  clampDiscursiveScore,
  discursiveQuestionIdsOf,
  gradeObjectives,
  resolveCorrectionStatus,
  totalCorrectionScore,
  type MarkedAnswer,
} from '@/lib/grading'
import { correctionSchema } from '@/lib/schemas'
import { createCollection, simulateLatency } from '@/lib/storage/collection'
import { StorageError } from '@/lib/storage/errors'
import { createId } from '@/lib/utils'
import {
  CORRECTION_SOURCE,
  CORRECTION_STATUS,
  type AnswerSheet,
  type Correction,
  type DiscursiveScore,
  type Exam,
  type Question,
} from '@/types/domain'

/**
 * What the teacher decided on the review screen (P16), and nothing else. The
 * grade, the status and who the correction is for are worked out by whoever
 * stores it, from these choices (#47).
 */
export interface ReviewInput {
  answerSheetId: string
  answers: readonly MarkedAnswer[]
  discursiveScores: readonly DiscursiveScore[]
  /** False keeps the correction open on purpose (RF47), for a teacher who stops in the middle. */
  finalize: boolean
  notes?: string
  /** The student of a sheet printed without a name (RF31). */
  studentId?: string
  /** The photo the review was made from; left out for a correction typed by hand (RF30). */
  imageId?: string
}

/** What a later review may change; the sheet and the photo stay as they were. */
export type ReviewChanges = Partial<Omit<ReviewInput, 'answerSheetId' | 'imageId'>>

export interface CorrectionFilter {
  /** `false` keeps only the corrections still waiting for their student (P17). */
  assigned?: boolean
}

/**
 * The corrections of an application, as the API serves them under it (#47).
 * A correction is never sent whole: the review goes in and the graded
 * correction comes back, so a screen cannot store a grade of its own making.
 */
export interface CorrectionRepository {
  listByApplication: (applicationId: string, filter?: CorrectionFilter) => Promise<Correction[]>
  create: (applicationId: string, review: ReviewInput) => Promise<Correction>
  update: (applicationId: string, correctionId: string, changes: ReviewChanges) => Promise<Correction>
}

/** The key a photo is stored under, the same on the API and in the demo, which is what `imageUrl` keeps (ADR-004). */
export function sheetImageKey(applicationId: string, imageId: string): string {
  return `answer-sheets/${applicationId}/${imageId}`
}

/** The id of the photo a correction was confirmed from, read back from the key in `imageUrl`. */
export function sheetImageIdOf(imageUrl: string | undefined): string | undefined {
  const file = imageUrl?.split('/').at(-1)
  return file === undefined || file === '' ? undefined : file.replace(/\.[a-z]+$/i, '')
}

/** What the demo grades a review against: the sheets and the exam of an application, read when asked. */
export interface LocalGradingSources {
  teacherId: string
  sheetsOf: (applicationId: string) => Promise<AnswerSheet[]>
  examOf: (applicationId: string) => Promise<{ exam: Exam; questions: Question[] } | null>
}

const NOT_FOUND = 'Correção não encontrada.'
const SHEET_NOT_FOUND = 'Folha não encontrada.'
const SHEET_ALREADY_CORRECTED = 'Esta folha já tem correção. Edite a correção existente.'
const DUPLICATE_STUDENT = 'Já existe uma correção deste aluno nesta versão. Verifique se duas folhas foram lidas como a mesma pessoa.'

/**
 * The grade of a review with the rules the API applies (`@correctio/domain`),
 * so the demo shows what production would store: `DONE` only when finalized
 * with every open-ended question marked, zero included (RF28, RF47).
 */
function gradeReview({ exam, questions }: { exam: Exam; questions: Question[] }, review: Pick<ReviewInput, 'answers' | 'discursiveScores' | 'finalize'>) {
  const maxScoreOf = new Map(questions.map((question) => [question.id, question.maxScore ?? 0]))
  const discursiveScores = review.discursiveScores.map(({ questionId, score }) => ({ questionId, score: clampDiscursiveScore(score, maxScoreOf.get(questionId) ?? 0) }))
  const { results } = gradeObjectives(exam, questions, review.answers)
  const status = review.finalize ? resolveCorrectionStatus(discursiveQuestionIdsOf(exam, questions), discursiveScores) : CORRECTION_STATUS.IN_PROGRESS
  return { objectiveResults: results, discursiveScores, totalScore: totalCorrectionScore(results, discursiveScores), status }
}

const answersOf = (correction: Correction): MarkedAnswer[] =>
  correction.objectiveResults.map(({ questionId, selectedAlternativeId }) => ({
    questionId,
    ...(selectedAlternativeId !== undefined && { selectedAlternativeId }),
  }))

/**
 * The demo and the unit tests: corrections in this browser, graded here with
 * the rules the API uses. Two corrections of one student on one version are a
 * conflict, as on the API: two sheets were read as the same person.
 */
export function createLocalCorrectionRepository(sources: LocalGradingSources): CorrectionRepository {
  const collection = createCollection('corrections', correctionSchema)

  async function gradingOf(applicationId: string) {
    const graded = await sources.examOf(applicationId)
    if (graded === null) throw new StorageError(NOT_FOUND, 'not-found')
    return graded
  }

  function assertNoDuplicate(correction: Correction, all: readonly Correction[]): void {
    if (correction.studentId === undefined) return
    const clash = all.some((item) => item.id !== correction.id && item.examVersionId === correction.examVersionId && item.studentId === correction.studentId)
    if (clash) throw new StorageError(DUPLICATE_STUDENT, 'conflict')
  }

  function store(correction: Correction): Correction {
    const all = collection.readAll()
    assertNoDuplicate(correction, all)
    const index = all.findIndex((item) => item.id === correction.id)
    collection.writeAll(index === -1 ? [...all, correction] : all.with(index, correction))
    return correction
  }

  const listByApplication: CorrectionRepository['listByApplication'] = async (applicationId, { assigned } = {}) => {
    await simulateLatency()
    const sheetIds = new Set((await sources.sheetsOf(applicationId)).map((sheet) => sheet.id))
    return collection
      .readAll()
      .filter((item) => sheetIds.has(item.answerSheetId))
      .filter((item) => assigned === undefined || (item.studentId !== undefined) === assigned)
  }

  return {
    listByApplication,

    async create(applicationId, { answerSheetId, imageId, studentId, notes, ...review }) {
      await simulateLatency()
      const sheet = (await sources.sheetsOf(applicationId)).find((item) => item.id === answerSheetId)
      if (sheet === undefined) throw new StorageError(SHEET_NOT_FOUND, 'not-found')
      if (collection.readAll().some((item) => item.answerSheetId === answerSheetId)) throw new StorageError(SHEET_ALREADY_CORRECTED, 'conflict')

      const owner = sheet.studentId ?? studentId
      return store({
        id: createId(),
        examVersionId: sheet.examVersionId,
        answerSheetId,
        ...gradeReview(await gradingOf(applicationId), review),
        ...(owner !== undefined && { studentId: owner }),
        ...(notes !== undefined && { notes }),
        isAutomaticallyAssigned: sheet.studentId !== undefined,
        confirmedAt: new Date().toISOString(),
        correctedBy: sources.teacherId,
        clientCorrectionId: createId(),
        syncStatus: 'synced',
        source: imageId === undefined ? CORRECTION_SOURCE.MANUAL : CORRECTION_SOURCE.IMAGE_UPLOAD,
        ...(imageId !== undefined && { imageUrl: sheetImageKey(applicationId, imageId) }),
      })
    },

    async update(applicationId, correctionId, { studentId, notes, ...changes }) {
      await simulateLatency()
      const current = (await listByApplication(applicationId)).find((item) => item.id === correctionId)
      if (current === undefined) throw new StorageError(NOT_FOUND, 'not-found')

      const review = {
        answers: changes.answers ?? answersOf(current),
        discursiveScores: changes.discursiveScores ?? current.discursiveScores,
        finalize: changes.finalize ?? current.status === CORRECTION_STATUS.DONE,
      }
      return store({
        ...current,
        ...gradeReview(await gradingOf(applicationId), review),
        ...(studentId !== undefined && { studentId, isAutomaticallyAssigned: false }),
        ...(notes !== undefined && { notes }),
        confirmedAt: new Date().toISOString(),
      })
    },
  }
}
