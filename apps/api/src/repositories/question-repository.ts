/* eslint-disable */
import type { Kysely } from 'kysely';
import type { Database } from '../models/tables.js';

export class QuestionRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(data: any) {
    await (this.db as any)
      .insertInto('questions')
      .values({
        id: data.id,
        teacherId: data.teacherId,
        type: data.type,
        statement: data.statement,
        tags: data.tags ? JSON.stringify(data.tags) : JSON.stringify([]),
        alternatives: data.alternatives ? JSON.stringify(data.alternatives) : null,
        correctAlternativeId: data.correctAlternativeId || null,
        maxScore: data.maxScore || null,
        allowShuffleAlternatives: data.allowShuffleAlternatives ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .execute();

    return this.findById(data.id, data.teacherId);
  }

  async findById(id: string, teacherId: string) {
    const question = await (this.db as any)
      .selectFrom('questions')
      .selectAll()
      .where('id', '=', id)
      .where('teacherId', '=', teacherId)
      .executeTakeFirst();

    if (!question) return null;

    return {
      ...question,
      tags: typeof question.tags === 'string' ? JSON.parse(question.tags) : question.tags,
      alternatives:
        typeof question.alternatives === 'string'
          ? JSON.parse(question.alternatives)
          : question.alternatives,
    };
  }

  async findMany(teacherId: string, filters: any) {
    let query = (this.db as any).selectFrom('questions').where('teacherId', '=', teacherId);

    if (filters.archived) {
      query = query.where('deletedAt', 'is not', null);
    } else {
      query = query.where('deletedAt', 'is', null);
    }

    if (filters.type) query = query.where('type', '=', filters.type);

    if (filters.search) {
      const like = `%${filters.search}%`;
      query = query.where((eb: any) =>
        eb.or([eb('statement', 'like', like), eb('tags', 'like', like)]),
      );
    }

    if (filters.onlyUntagged) {
      query = query.where('tags', '=', JSON.stringify([]));
    } else if (filters.tags && filters.tags.length > 0) {
      filters.tags.forEach((tag: string) => {
        query = query.where((eb: any) => eb.bxp('JSON_CONTAINS(tags)', '=', `"${tag}"`));
      });
    }

    const { count } = await query
      .select((eb: any) => eb.fn.count('id').as('count'))
      .executeTakeFirstOrThrow();

    if (filters.sort === 'statement') {
      query = query.orderBy('statement', 'asc');
    } else {
      query = query.orderBy('createdAt', 'desc');
    }

    const page = filters.page ? Number(filters.page) : 1;
    const pageSize = filters.pageSize ? Number(filters.pageSize) : 10;
    const offset = (page - 1) * pageSize;

    const items = await query.selectAll().limit(pageSize).offset(offset).execute();

    return {
      items: items.map((q: any) => ({
        ...q,
        tags: typeof q.tags === 'string' ? JSON.parse(q.tags) : q.tags,
        alternatives:
          typeof q.alternatives === 'string' ? JSON.parse(q.alternatives) : q.alternatives,
      })),
      total: Number(count),
    };
  }

  async findDistinctTags(teacherId: string): Promise<string[]> {
    const rows = await (this.db as any)
      .selectFrom('questions')
      .select('tags')
      .where('teacherId', '=', teacherId)
      .where('deletedAt', 'is', null)
      .execute();

    const set = new Set<string>();
    for (const row of rows) {
      try {
        const tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
        if (Array.isArray(tags)) {
          tags.forEach((t) => {
            if (typeof t === 'string' && t.length > 0) set.add(t);
          });
        }
      } catch {
        // ignore malformed JSON
      }
    }
    return Array.from(set).sort();
  }

  async update(id: string, teacherId: string, data: any) {
    const updateData: any = { updatedAt: new Date() };

    if (data.type !== undefined) updateData.type = data.type;
    if (data.statement !== undefined) updateData.statement = data.statement;
    if (data.maxScore !== undefined)
      updateData.maxScore = data.maxScore === null ? null : data.maxScore;
    if (data.allowShuffleAlternatives !== undefined)
      updateData.allowShuffleAlternatives = data.allowShuffleAlternatives;

    if (data.tags !== undefined)
      updateData.tags = data.tags === null ? JSON.stringify([]) : JSON.stringify(data.tags);
    if (data.alternatives !== undefined)
      updateData.alternatives =
        data.alternatives === null ? null : JSON.stringify(data.alternatives);
    if (data.correctAlternativeId !== undefined)
      updateData.correctAlternativeId = data.correctAlternativeId;

    await (this.db as any)
      .updateTable('questions')
      .set(updateData)
      .where('id', '=', id)
      .where('teacherId', '=', teacherId)
      .execute();

    return this.findById(id, teacherId);
  }

  async softDelete(id: string, teacherId: string) {
    await (this.db as any)
      .updateTable('questions')
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where('id', '=', id)
      .where('teacherId', '=', teacherId)
      .execute();
  }

  async restore(id: string, teacherId: string) {
    await (this.db as any)
      .updateTable('questions')
      .set({ deletedAt: null, updatedAt: new Date() })
      .where('id', '=', id)
      .where('teacherId', '=', teacherId)
      .execute();
  }
}