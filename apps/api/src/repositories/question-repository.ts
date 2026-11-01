import {
  sql,
  type ExpressionBuilder,
  type Kysely,
  type OperandExpression,
  type SqlBool,
} from 'kysely'
import type { Database } from '../models/tables'
import type { QuestionType } from '@correctio/domain'

/**
 * The primary key of `question_tags`, on the question and the tag. It compares
 * the tag under the collation of the column, which ignores case and accents.
 */
export const QUESTION_TAG_INDEX = 'question_tags.PRIMARY'

/**
 * The shape of a question as the API exposes it, mirrors `questionSchema`.
 *
 * Optional fields are omitted when they have no value, not sent as `null`: the
 * shared schema types them as `.optional()`, not `.nullable()`, so a `null`
 * would fail validation on the front side. `deletedAt` is omitted while the
 * question is active.
 */
export interface QuestionRecord {
  id: string
  teacherId: string
  type: QuestionType
  statement: string
  tags: string[]
  allowShuffleAlternatives: boolean
  createdAt: Date
  updatedAt: Date
  alternatives?: Array<{ id: string; text: string }>
  correctAlternativeId?: string
  maxScore?: number
  deletedAt?: Date
}

/** The mutable part of a question, the one a create or an update actually writes. */
export interface QuestionWrite {
  type: QuestionType
  statement: string
  tags: string[]
  alternatives: Array<{ id: string; text: string }> | null
  correctAlternativeId: string | null
  maxScore: number | null
  allowShuffleAlternatives: boolean
}

export interface QuestionFilters {
  search?: string
  type?: QuestionType
  tags?: string[]
  onlyUntagged?: boolean
  archived?: boolean
  sort?: 'newest' | 'statement'
  page?: number
  pageSize?: number
}

/** Escapes `%` and `_` so a literal search does not become a wildcard. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

/** Predicate for `search`, `onlyUntagged` and `tags`, applied before pagination. */
function whereOf(filters: QuestionFilters) {
  return (eb: ExpressionBuilder<Database, 'questions'>): OperandExpression<SqlBool> => {
    const terms: OperandExpression<SqlBool>[] = []

    if (filters.search !== undefined && filters.search.length > 0) {
      const like = `%${escapeLike(filters.search)}%`
      terms.push(
        eb.or([
          eb('statement', 'like', like),
          eb(
            'id',
            'in',
            eb.selectFrom('question_tags').select('questionId').where('tag', 'like', like),
          ),
        ]),
      )
    }

    if (filters.onlyUntagged === true) {
      terms.push(
        eb.not(
          eb.exists(
            eb
              .selectFrom('question_tags')
              .select('questionId')
              .whereRef('question_tags.questionId', '=', 'questions.id'),
          ),
        ),
      )
    } else if (filters.tags !== undefined && filters.tags.length > 0) {
      const tags = filters.tags
      terms.push(
        eb(
          'id',
          'in',
          eb
            .selectFrom('question_tags')
            .select('questionId')
            .where('tag', 'in', tags)
            .groupBy('questionId')
            .having(sql<number>`COUNT(DISTINCT tag)`, '=', tags.length),
        ),
      )
    }

    if (terms.length === 0) return eb.val(true)
    return eb.and(terms)
  }
}

/** The child rows of a page of questions, grouped by question id. */
interface ChildRows {
  alternatives: Map<string, Array<{ id: string; text: string }>>
  tags: Map<string, string[]>
}

export class QuestionRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(id: string, teacherId: string, data: QuestionWrite): Promise<QuestionRecord> {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto('questions')
        .values({
          id,
          teacherId,
          type: data.type,
          statement: data.statement,
          correctAlternativeId: data.correctAlternativeId,
          maxScore: data.maxScore,
          deletedAt: null,
          allowShuffleAlternatives: data.allowShuffleAlternatives,
        })
        .execute()

      await this.writeChildren(trx, id, data)
    })

    const created = await this.findById(id, teacherId)
    if (created === null) throw new Error('question vanished after create')
    return created
  }

  async findById(id: string, teacherId: string): Promise<QuestionRecord | null> {
    const row = await this.db
      .selectFrom('questions')
      .selectAll()
      .where('id', '=', id)
      .where('teacherId', '=', teacherId)
      .executeTakeFirst()

    if (row === undefined) return null

    const children = await this.loadChildren([row.id])
    return this.hydrate(row, children)
  }

  /**
   * The questions of the teacher with these ids, deleted ones included, in no
   * particular order. An exam keeps a question deleted from the bank after it
   * joined, and its printed versions still need the alternatives, so the
   * generation of an application reads by id rather than from the bank.
   */
  async findByIds(teacherId: string, ids: readonly string[]): Promise<QuestionRecord[]> {
    if (ids.length === 0) return []

    const rows = await this.db
      .selectFrom('questions')
      .selectAll()
      .where('teacherId', '=', teacherId)
      .where('id', 'in', [...ids])
      .execute()

    const children = await this.loadChildren(rows.map((row) => row.id))
    return rows.map((row) => this.hydrate(row, children))
  }

  async findMany(teacherId: string, filters: QuestionFilters) {
    let query = this.db
      .selectFrom('questions')
      .where('teacherId', '=', teacherId)
      .where('deletedAt', filters.archived === true ? 'is not' : 'is', null)
      .where(whereOf(filters))

    if (filters.type !== undefined) {
      query = query.where('type', '=', filters.type)
    }

    const countRow = await query
      .clearSelect()
      .select((eb) => eb.fn.count<number>('id').as('count'))
      .executeTakeFirstOrThrow()

    query =
      filters.sort === 'statement'
        ? query.orderBy('statement', 'asc')
        : query.orderBy('createdAt', 'desc')

    const page = filters.page ?? 1
    const pageSize = filters.pageSize ?? 50
    const offset = (page - 1) * pageSize

    const rows = await query.selectAll().limit(pageSize).offset(offset).execute()

    const children = await this.loadChildren(rows.map((row) => row.id))

    return {
      items: rows.map((row) => this.hydrate(row, children)),
      total: Number(countRow.count),
    }
  }

  async findDistinctTags(teacherId: string): Promise<string[]> {
    const rows = await this.db
      .selectFrom('question_tags')
      .innerJoin('questions', 'questions.id', 'question_tags.questionId')
      .select('question_tags.tag')
      .distinct()
      .where('questions.teacherId', '=', teacherId)
      .where('questions.deletedAt', 'is', null)
      .execute()

    return rows.map((row) => row.tag).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }

  async update(id: string, teacherId: string, data: QuestionWrite): Promise<QuestionRecord> {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .updateTable('questions')
        .set({
          type: data.type,
          statement: data.statement,
          correctAlternativeId: data.correctAlternativeId,
          maxScore: data.maxScore,
          allowShuffleAlternatives: data.allowShuffleAlternatives,
        })
        .where('id', '=', id)
        .where('teacherId', '=', teacherId)
        .execute()

      await trx.deleteFrom('question_alternatives').where('questionId', '=', id).execute()
      await trx.deleteFrom('question_tags').where('questionId', '=', id).execute()

      await this.writeChildren(trx, id, data)
    })

    const updated = await this.findById(id, teacherId)
    if (updated === null) throw new Error('question vanished after update')
    return updated
  }

  async softDelete(id: string, teacherId: string): Promise<void> {
    await this.db
      .updateTable('questions')
      .set({ deletedAt: new Date() })
      .where('id', '=', id)
      .where('teacherId', '=', teacherId)
      .execute()
  }

  async restore(id: string, teacherId: string): Promise<void> {
    await this.db
      .updateTable('questions')
      .set({ deletedAt: null })
      .where('id', '=', id)
      .where('teacherId', '=', teacherId)
      .execute()
  }

  /** Writes the two child tables, in the transaction the caller already opened. */
  private async writeChildren(
    trx: Kysely<Database>,
    questionId: string,
    data: QuestionWrite,
  ): Promise<void> {
    if (data.alternatives !== null && data.alternatives.length > 0) {
      await trx
        .insertInto('question_alternatives')
        .values(
          data.alternatives.map((alternative, index) => ({
            questionId,
            id: alternative.id,
            text: alternative.text,
            position: index,
          })),
        )
        .execute()
    }

    if (data.tags.length > 0) {
      await trx
        .insertInto('question_tags')
        .values(data.tags.map((tag) => ({ questionId, tag })))
        .execute()
    }
  }

  /**
   * Loads the child rows of a page in two queries, one per table, and groups
   * them by question id. Empty ids are tolerated so callers never branch on it.
   *
   * Batching matters: a page of 50 rows would otherwise cost 100 extra
   * round-trips, one per child table per question.
   */
  private async loadChildren(ids: string[]): Promise<ChildRows> {
    if (ids.length === 0) {
      return { alternatives: new Map(), tags: new Map() }
    }

    const [alternativeRows, tagRows] = await Promise.all([
      this.db
        .selectFrom('question_alternatives')
        .select(['questionId', 'id', 'text'])
        .where('questionId', 'in', ids)
        .orderBy('position', 'asc')
        .execute(),
      this.db
        .selectFrom('question_tags')
        .select(['questionId', 'tag'])
        .where('questionId', 'in', ids)
        .orderBy('tag', 'asc')
        .execute(),
    ])

    const alternatives = new Map<string, Array<{ id: string; text: string }>>()
    for (const row of alternativeRows) {
      const list = alternatives.get(row.questionId) ?? []
      list.push({ id: row.id, text: row.text })
      alternatives.set(row.questionId, list)
    }

    const tags = new Map<string, string[]>()
    for (const row of tagRows) {
      const list = tags.get(row.questionId) ?? []
      list.push(row.tag)
      tags.set(row.questionId, list)
    }

    return { alternatives, tags }
  }

  /**
   * Reassembles a question from its row and the loaded child rows.
   *
   * Fields that have no value are omitted rather than sent as `null`: the
   * shared schema is `.optional()`, not `.nullable()`, so a `null` would fail
   * on the front when the response is validated.
   */
  private hydrate(
    row: {
      id: string
      teacherId: string
      type: QuestionType
      statement: string
      correctAlternativeId: string | null
      maxScore: number | null
      deletedAt: Date | null
      allowShuffleAlternatives: boolean
      createdAt: Date
      updatedAt: Date
    },
    children: ChildRows,
  ): QuestionRecord {
    const record: QuestionRecord = {
      id: row.id,
      teacherId: row.teacherId,
      type: row.type,
      statement: row.statement,
      tags: children.tags.get(row.id) ?? [],
      allowShuffleAlternatives: row.allowShuffleAlternatives,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }

    if (row.type === 'objetiva') {
      record.alternatives = children.alternatives.get(row.id) ?? []
    }

    if (row.correctAlternativeId !== null) {
      record.correctAlternativeId = row.correctAlternativeId
    }

    if (row.maxScore !== null) {
      record.maxScore = row.maxScore
    }

    if (row.deletedAt !== null) {
      record.deletedAt = row.deletedAt
    }

    return record
  }
}