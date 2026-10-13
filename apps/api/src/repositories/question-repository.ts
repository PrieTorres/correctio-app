import {
  sql,
  type ExpressionBuilder,
  type Kysely,
  type OperandExpression,
  type SqlBool,
} from 'kysely'
import type { Database } from '../models/tables'
import type { QuestionType } from '@correctio/domain'

/** The shape of a question as the API exposes it, mirrors `questionSchema`. */
export interface QuestionRecord {
  id: string
  teacherId: string
  type: QuestionType
  statement: string
  tags: string[]
  alternatives: Array<{ id: string; text: string }> | null
  correctAlternativeId: string | null
  maxScore: number | null
  allowShuffleAlternatives: boolean
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
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
    return this.hydrate(row)
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
    const items = await Promise.all(rows.map((row) => this.hydrate(row)))

    return { items, total: Number(countRow.count) }
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

  /** Reassembles a question from its row and its two child tables. */
  private async hydrate(row: {
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
  }): Promise<QuestionRecord> {
    const [alternatives, tags] = await Promise.all([
      row.type === 'objetiva'
        ? this.db
            .selectFrom('question_alternatives')
            .select(['id', 'text'])
            .where('questionId', '=', row.id)
            .orderBy('position', 'asc')
            .execute()
        : Promise.resolve([] as Array<{ id: string; text: string }>),
      this.db
        .selectFrom('question_tags')
        .select('tag')
        .where('questionId', '=', row.id)
        .orderBy('tag', 'asc')
        .execute(),
    ])

    return {
      id: row.id,
      teacherId: row.teacherId,
      type: row.type,
      statement: row.statement,
      correctAlternativeId: row.correctAlternativeId,
      maxScore: row.maxScore,
      deletedAt: row.deletedAt,
      allowShuffleAlternatives: row.allowShuffleAlternatives,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      alternatives: row.type === 'objetiva' ? alternatives : null,
      tags: tags.map((tag) => tag.tag),
    }
  }
}