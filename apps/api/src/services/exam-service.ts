import { randomUUID } from 'node:crypto'
import { drawQuestions, drawRequestSchema, examInputSchema, type DrawResult, type Exam, type ExamInput, type ExamQuestion } from '@correctio/domain'
import { API_ERROR_CODE, ApiError } from '../lib/api-error'
import { mergePatch } from '../lib/merge-patch'
import { MAX_PAGE_SIZE, parsePageRequest, type Page } from '../lib/pagination'
import { parseRequest } from '../lib/parse-request'
import type { ExamRepository } from '../repositories/exam-repository'
import type { QuestionRecord, QuestionRepository } from '../repositories/question-repository'

/** The fields of the exam form; the rest of an `Exam` is decided by the server. */
const EXAM_FIELDS = ['title', 'description', 'questions', 'defaultShuffleQuestions', 'defaultShuffleAlternatives'] as const satisfies readonly (keyof ExamInput)[]

const NOT_FOUND = 'Prova não encontrada.'

/** The same messages the web app shows today (`requireUnique` in `create-owned-repository.ts`). */
const DUPLICATE = 'Já existe uma prova com estes dados.'
const DUPLICATE_ARCHIVED = 'Já existe uma prova arquivada com estes dados. Restaure em vez de criar outra.'

const REPEATED_QUESTION = 'A mesma questão aparece duas vezes na prova.'
const REPEATED_POSITION = 'Duas questões ocupam a mesma posição na prova.'
/** Says nothing about whether the question exists for someone else. */
const UNKNOWN_QUESTION = 'Uma das questões não está no seu banco.'

export interface ExamService {
  list: (teacherId: string, query: unknown) => Promise<Page<Exam>>
  get: (teacherId: string, id: string) => Promise<Exam>
  create: (teacherId: string, body: unknown) => Promise<Exam>
  update: (teacherId: string, id: string, body: unknown) => Promise<Exam>
  archive: (teacherId: string, id: string) => Promise<void>
  restore: (teacherId: string, id: string) => Promise<void>
  /** The automatic exam (RF16): a selection from the bank, which nothing stores until the teacher saves the exam. */
  draw: (teacherId: string, body: unknown) => Promise<DrawResult<QuestionRecord>>
  /** Records that the exam was applied: generating an application (#46) calls this, never a route. */
  markReady: (teacherId: string, id: string) => Promise<void>
}

export interface ExamServiceDependencies {
  exams: ExamRepository
  questions: Pick<QuestionRepository, 'findMany'>
}

const invalid = (message: string) => new ApiError(API_ERROR_CODE.INVALID, message)

function pickForm(exam: Exam): Pick<Exam, (typeof EXAM_FIELDS)[number]> {
  return {
    title: exam.title,
    description: exam.description,
    questions: exam.questions,
    defaultShuffleQuestions: exam.defaultShuffleQuestions,
    defaultShuffleAlternatives: exam.defaultShuffleAlternatives,
  }
}

/** No question twice, and no two questions in the same place: the order is what the versions shuffle from. */
function requireDistinct(questions: readonly ExamQuestion[]): void {
  if (new Set(questions.map((entry) => entry.questionId)).size !== questions.length) throw invalid(REPEATED_QUESTION)
  if (new Set(questions.map((entry) => entry.order)).size !== questions.length) throw invalid(REPEATED_POSITION)
}

/**
 * The exams of a teacher (P8 to P10, RF13 to RF18). The owner comes from the
 * token, `status` is the server's (born `draft`, `ready` once applied,
 * `closed` when archived) and an exam is archived, never deleted (RF42).
 */
export function createExamService({ exams, questions }: ExamServiceDependencies): ExamService {
  async function requireExam(teacherId: string, id: string): Promise<Exam> {
    const exam = await exams.findById(teacherId, id)
    if (exam === undefined) throw new ApiError(API_ERROR_CODE.NOT_FOUND, NOT_FOUND)
    return exam
  }

  /**
   * Every question is the teacher's. One deleted from the bank still counts:
   * deleting takes it out of the bank, not out of the exams that use it.
   */
  async function requireOwnQuestions(teacherId: string, entries: readonly ExamQuestion[]): Promise<void> {
    requireDistinct(entries)
    const ids = entries.map((entry) => entry.questionId)
    const own = await exams.ownQuestionIds(teacherId, ids)
    if (ids.some((id) => !own.has(id))) throw invalid(UNKNOWN_QUESTION)
  }

  /** The title is how a teacher tells exams apart, so it is unique, archived ones included, without accents or case. */
  async function requireUnique(teacherId: string, title: string, exceptId?: string): Promise<void> {
    const clash = await exams.findClash(teacherId, title, exceptId)
    if (clash === undefined) return
    throw new ApiError(API_ERROR_CODE.CONFLICT, clash.status === 'closed' ? DUPLICATE_ARCHIVED : DUPLICATE)
  }

  return {
    list: (teacherId, query) => exams.list(teacherId, parsePageRequest(query)),

    get: requireExam,

    async create(teacherId, body) {
      const input = parseRequest(examInputSchema, body)
      await requireOwnQuestions(teacherId, input.questions)
      await requireUnique(teacherId, input.title)
      const exam: Exam = { id: randomUUID(), teacherId, ...input, status: 'draft' }
      await exams.insert(exam)
      return exam
    },

    async update(teacherId, id, body) {
      const current = await requireExam(teacherId, id)
      const { merged, sent } = mergePatch(pickForm(current), body, EXAM_FIELDS)
      const input = parseRequest(examInputSchema, merged)
      await requireOwnQuestions(teacherId, input.questions)
      await requireUnique(teacherId, input.title, id)

      const changes: Partial<ExamInput> = {}
      for (const field of sent) Object.assign(changes, { [field]: input[field] })
      await exams.update(teacherId, id, changes)
      return { ...current, ...input }
    },

    async archive(teacherId, id) {
      await requireExam(teacherId, id)
      await exams.setStatus(teacherId, id, 'closed')
    },

    /** Back to `draft`, never to `ready`: an exam coming out of the archive has no application waiting for it. */
    async restore(teacherId, id) {
      await requireExam(teacherId, id)
      await exams.setStatus(teacherId, id, 'draft')
    },

    /**
     * Draws from the active questions of the teacher carrying any of the tags asked,
     * leaving out the ones already in the exam or on screen, with the same
     * function the screens used to run (`@correctio/domain`).
     */
    async draw(teacherId, body) {
      const { tags, excludeIds, ...counts } = parseRequest(drawRequestSchema, body)
      const { items } = await questions.findMany(teacherId, { tags, anyTag: true, archived: false, page: 1, pageSize: MAX_PAGE_SIZE })
      const excluded = new Set(excludeIds)
      return drawQuestions(
        items.filter((question) => !excluded.has(question.id)),
        { tags, ...counts },
      )
    },

    async markReady(teacherId, id) {
      await requireExam(teacherId, id)
      await exams.markReady(teacherId, id)
    },
  }
}
