import { randomUUID } from 'node:crypto'
import { questionInputSchema } from '@correctio/domain'
import { z } from 'zod'
import { isDuplicateEntry } from '../db/errors'
import { API_ERROR_CODE, ApiError } from '../lib/api-error'
import { booleanParam } from '../lib/pagination'
import { parseRequest } from '../lib/parse-request'
import {
  QUESTION_TAG_INDEX,
  type QuestionRecord,
  type QuestionRepository,
  type QuestionWrite,
} from '../repositories/question-repository'

/**
 * The schema already refuses two tags that differ only in case or accents;
 * this is for the rare pair it compares apart and the database does not, such
 * as "ß" and "ss".
 */
const REPEATED_TAGS = 'Duas tags são a mesma para o banco de questões: deixe só uma'

/**
 * Writes and turns a tag refused by the key of `question_tags` into a 400.
 * Anything else the database refuses is unexpected, and stays a 500.
 */
async function writeQuestion(write: () => Promise<QuestionRecord>): Promise<QuestionRecord> {
  try {
    return await write()
  } catch (error) {
    if (isDuplicateEntry(error, QUESTION_TAG_INDEX)) {
      throw new ApiError(API_ERROR_CODE.INVALID, REPEATED_TAGS, { cause: error })
    }
    throw error
  }
}

/** The `pageSize` ceiling documented in the README. */
const MAX_PAGE_SIZE = 1000

/** A repeated `tags=math&tags=algebra` query arrives as an array; a single one as a string. */
const tagsParam = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => (Array.isArray(value) ? value : [value]))

/** Validates and normalises `GET /questions` query string before the repository sees it. */
const listFiltersSchema = z.object({
  search: z.string().optional(),
  type: z.enum(['objetiva', 'discursiva']).optional(),
  tags: tagsParam.optional(),
  anyTag: booleanParam.optional(),
  onlyUntagged: booleanParam.optional(),
  archived: booleanParam.optional(),
  sort: z.enum(['newest', 'statement']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
})

/**
 * Only the fields the input schema expects for the record's own type, so a
 * merge never carries `id`/`teacherId` and never carries the fields of the
 * other type (`maxScore` on an objective, alternatives on a discursive one).
 */
function pickInput(record: QuestionRecord) {
  if (record.type === 'objetiva') {
    return {
      type: record.type,
      statement: record.statement,
      tags: record.tags,
      alternatives: record.alternatives,
      correctAlternativeId: record.correctAlternativeId,
      allowShuffleAlternatives: record.allowShuffleAlternatives,
    }
  }

  return {
    type: record.type,
    statement: record.statement,
    tags: record.tags,
    maxScore: record.maxScore,
    allowShuffleAlternatives: record.allowShuffleAlternatives,
  }
}

/** Discriminates the alternative list a `QuestionWrite` expects from an input. */
function toWrite(input: ReturnType<typeof questionInputSchema.parse>): QuestionWrite {
  return {
    type: input.type,
    statement: input.statement,
    tags: input.tags,
    alternatives: input.type === 'objetiva' ? (input.alternatives ?? null) : null,
    correctAlternativeId: input.type === 'objetiva' ? (input.correctAlternativeId ?? null) : null,
    maxScore: input.type === 'discursiva' ? (input.maxScore ?? null) : null,
    allowShuffleAlternatives: input.allowShuffleAlternatives,
  }
}

export class QuestionService {
  constructor(private readonly repository: QuestionRepository) {}

  /** A refusal answers the schema's own message, so the API says what the form says (#184). */
  async create(teacherId: string, data: unknown) {
    const input = parseRequest(questionInputSchema, data)

    return writeQuestion(() => this.repository.create(randomUUID(), teacherId, toWrite(input)))
  }

  async getById(id: string, teacherId: string) {
    const question = await this.repository.findById(id, teacherId)

    if (question === null) {
      throw new ApiError(API_ERROR_CODE.NOT_FOUND, 'Questão não encontrada.')
    }

    return question
  }

  async list(teacherId: string, raw: unknown) {
    const parsed = listFiltersSchema.safeParse(raw)

    if (!parsed.success) {
      throw new ApiError(API_ERROR_CODE.INVALID, 'Filtros inválidos.')
    }

    return this.repository.findMany(teacherId, parsed.data)
  }

  async listTags(teacherId: string) {
    return this.repository.findDistinctTags(teacherId)
  }

  /**
   * Merges the record's own fields with the client's change.
   *
   * `null` from the client means "clear this field", and the schema wants the
   * field absent, so nulls are dropped before the merge. What survives is the
   * client's change plus the record's fields, still in the shape of the type
   * the record had. The target type then decides which of the two types'
   * fields survive: the schema rejects the other type's fields, and a switch
   * from objective to discursive must drop `alternatives` and
   * `correctAlternativeId` for the row to become a discursive one.
   */
  async update(id: string, teacherId: string, data: unknown) {
    const current = await this.getById(id, teacherId)

    if (data === null || typeof data !== 'object') {
      throw new ApiError(API_ERROR_CODE.INVALID, 'Dados da questão inválidos.')
    }

    const incoming = data as Record<string, unknown>

    const cleared: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(incoming)) {
      if (value !== null) cleared[key] = value
    }

    const targetType =
      cleared.type === 'objetiva' || cleared.type === 'discursiva'
        ? cleared.type
        : current.type

    const merged: Record<string, unknown> = { ...pickInput(current), ...cleared, type: targetType }

    if (targetType === 'objetiva') {
      delete merged.maxScore
    } else {
      delete merged.alternatives
      delete merged.correctAlternativeId
    }

    const input = parseRequest(questionInputSchema, merged)

    return writeQuestion(() => this.repository.update(id, teacherId, toWrite(input)))
  }

  async archive(id: string, teacherId: string) {
    await this.getById(id, teacherId)
    await this.repository.softDelete(id, teacherId)
  }

  async restore(id: string, teacherId: string) {
    await this.getById(id, teacherId)
    await this.repository.restore(id, teacherId)
  }
}