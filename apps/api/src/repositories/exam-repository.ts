import type { Exam, ExamInput, ExamQuestion, ExamStatus } from '@correctio/domain'
import type { Kysely, Selectable } from 'kysely'
import { anyColumnContains, byText, sameText } from '../db/text-search'
import { pageWindow, type Page, type PageRequest } from '../lib/pagination'
import type { Database, ExamsTable } from '../models/tables'

/** The fields of `Exam` in the contract, other than its questions; `createdAt` and `updatedAt` stay in the database. */
const EXAM_COLUMNS = ['id', 'teacherId', 'title', 'status', 'description', 'defaultShuffleQuestions', 'defaultShuffleAlternatives'] as const

type ExamRow = Pick<Selectable<ExamsTable>, (typeof EXAM_COLUMNS)[number]>

/** An archived exam (RF42); `draft` and `ready` are the active ones. */
const ARCHIVED: ExamStatus = 'closed'

export interface ExamClash {
  id: string
  status: ExamStatus
}

export interface ExamRepository {
  /** Active or archived exams, searched by title and description, ordered by title, each with its questions. */
  list: (teacherId: string, request: PageRequest) => Promise<Page<Exam>>
  findById: (teacherId: string, id: string) => Promise<Exam | undefined>
  /** Another exam of the teacher with the same title, archived ones included. */
  findClash: (teacherId: string, title: string, exceptId?: string) => Promise<ExamClash | undefined>
  /** Which of `ids` are questions of the teacher, deleted ones included: an exam keeps the questions it already had. */
  ownQuestionIds: (teacherId: string, ids: readonly string[]) => Promise<ReadonlySet<string>>
  insert: (exam: Exam) => Promise<void>
  /** Writes only what `changes` carries; the questions, when sent, replace the exam's list whole. */
  update: (teacherId: string, id: string, changes: Partial<ExamInput>) => Promise<void>
  setStatus: (teacherId: string, id: string, status: ExamStatus) => Promise<void>
  /** `draft` becomes `ready` once the exam is applied; any other status stays. */
  markReady: (teacherId: string, id: string) => Promise<void>
}

/**
 * Every query is scoped by `teacherId`, so an exam of another teacher is simply
 * not found (`docs/Seguranca_e_LGPD.md`, section 2). The questions of an exam
 * live in `exam_questions`, in the order the teacher set.
 */
export function createExamRepository(db: Kysely<Database>): ExamRepository {
  const owned = (teacherId: string) => db.selectFrom('exams').where('teacherId', '=', teacherId)
  const ownedUpdate = (teacherId: string, id: string) => db.updateTable('exams').where('teacherId', '=', teacherId).where('id', '=', id)

  /** The questions of each exam, read in one query for the whole page. */
  async function withQuestions(rows: readonly ExamRow[]): Promise<Exam[]> {
    if (rows.length === 0) return []
    const entries = await db
      .selectFrom('exam_questions')
      .select(['examId', 'questionId', 'order', 'score', 'allowShuffleAlternatives'])
      .where(
        'examId',
        'in',
        rows.map((row) => row.id),
      )
      .orderBy('order')
      .execute()
    const byExam = new Map<string, ExamQuestion[]>()
    for (const { examId, ...entry } of entries) byExam.set(examId, [...(byExam.get(examId) ?? []), entry])
    return rows.map((row) => ({ ...row, questions: byExam.get(row.id) ?? [] }))
  }

  /** Writes the questions of an exam; the exam row must already exist. */
  async function insertQuestions(executor: Kysely<Database>, examId: string, questions: readonly ExamQuestion[]): Promise<void> {
    if (questions.length === 0) return
    await executor
      .insertInto('exam_questions')
      .values(questions.map((entry) => ({ examId, ...entry })))
      .execute()
  }

  return {
    async list(teacherId, { search, archived, page, pageSize }) {
      const filtered = owned(teacherId)
        .where('status', archived ? '=' : '<>', ARCHIVED)
        .$if(search !== '', (query) => query.where(anyColumnContains(['title', 'description'], search)))

      const { total } = await filtered.select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirstOrThrow()
      const { limit, offset } = pageWindow({ page, pageSize })
      const rows = await filtered.select(EXAM_COLUMNS).orderBy(byText('title')).orderBy('id').limit(limit).offset(offset).execute()
      return { items: await withQuestions(rows), total: Number(total) }
    },

    async findById(teacherId, id) {
      const row = await owned(teacherId).select(EXAM_COLUMNS).where('id', '=', id).executeTakeFirst()
      if (row === undefined) return undefined
      const [exam] = await withQuestions([row])
      return exam
    },

    findClash(teacherId, title, exceptId) {
      const sameTitle = owned(teacherId).select(['id', 'status']).where(sameText('title', title))
      return (exceptId === undefined ? sameTitle : sameTitle.where('id', '<>', exceptId)).executeTakeFirst()
    },

    async ownQuestionIds(teacherId, ids) {
      if (ids.length === 0) return new Set()
      const rows = await db
        .selectFrom('questions')
        .select('id')
        .where('teacherId', '=', teacherId)
        .where('id', 'in', [...ids])
        .execute()
      return new Set(rows.map((row) => row.id))
    },

    async insert({ questions, ...exam }) {
      await db.transaction().execute(async (trx) => {
        await trx.insertInto('exams').values(exam).execute()
        await insertQuestions(trx, exam.id, questions)
      })
    },

    async update(teacherId, id, { questions, ...fields }) {
      await db.transaction().execute(async (trx) => {
        if (Object.keys(fields).length > 0) {
          await trx.updateTable('exams').set(fields).where('teacherId', '=', teacherId).where('id', '=', id).execute()
        }
        if (questions === undefined) return
        await trx.deleteFrom('exam_questions').where('examId', '=', id).execute()
        await insertQuestions(trx, id, questions)
      })
    },

    async setStatus(teacherId, id, status) {
      await ownedUpdate(teacherId, id).set({ status }).execute()
    },

    async markReady(teacherId, id) {
      await ownedUpdate(teacherId, id).where('status', '=', 'draft').set({ status: 'ready' }).execute()
    },
  }
}
