import type { z } from 'zod'
import { StorageError } from '@/lib/storage/errors'
import { preserveUnknownFields } from '@/lib/storage/preserve-unknown-fields'
import type { ListParams, OwnedRepository, Page } from '../types'
import type { ApiClient, QueryParams } from './api-client'

/** What the screens show when the API answers in a shape the contract does not describe. */
export const UNEXPECTED_RESPONSE = 'O servidor respondeu num formato inesperado. Tente de novo em instantes.'

/**
 * How an entity leaves circulation on the API. Most use
 * `PATCH /<x>/:id/archive`; questions use `DELETE /questions/:id`, as in the
 * Spec's endpoint table, and the API turns it into a soft delete too.
 */
export type ArchiveRoute = 'patch-archive' | 'delete'

interface HttpRepositoryConfig<TEntity, TParams extends ListParams = ListParams> {
  api: ApiClient
  /** The collection path of the Spec's endpoint table, such as `/classes`. */
  resource: string
  schema: z.ZodType<TEntity>
  archiveRoute?: ArchiveRoute
  /**
   * Turns the entity's own filters into query string entries. This generic
   * does not know their names, so a resource such as questions passes `type`,
   * `tags`, `onlyUntagged` and `sort` through here. The keys it returns are
   * serialised the same way as the common ones, including array repetition.
   */
  extraQuery?: (params: TParams) => QueryParams
}

/**
 * A field the API cleared arrives as `null`, while the contract leaves it out.
 * Reading `null` as absent keeps one shape on the screens: code that checks
 * `=== undefined`, such as the archive by timestamp, keeps working.
 */
function withoutNulls(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw
  return Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== null))
}

/**
 * The schema of a record as the API answers it, typed by what it produces: a
 * field with a default, such as `AnswerSheet.answerCardVersion`, may be missing
 * from what arrives but is always there afterwards.
 */
export type ResponseSchema<TEntity> = z.ZodType<TEntity, z.ZodTypeDef, unknown>

/**
 * Validates one record from the API with the same schema that guards the local
 * data. A record that fails is an error, never a silent drop: an item vanishing
 * from a list is worse than a message saying something went wrong.
 */
export function parseEntity<TEntity>(schema: ResponseSchema<TEntity>, raw: unknown): TEntity {
  const clean = withoutNulls(raw)
  const result = schema.safeParse(clean)
  if (!result.success) throw new StorageError(UNEXPECTED_RESPONSE, 'failure', { cause: result.error })
  return preserveUnknownFields(clean, result.data)
}

function isPagePayload(raw: unknown): raw is { items: unknown[]; total: number } {
  if (typeof raw !== 'object' || raw === null) return false
  return 'items' in raw && Array.isArray(raw.items) && 'total' in raw && typeof raw.total === 'number'
}

export function parsePage<TEntity>(schema: ResponseSchema<TEntity>, raw: unknown): Page<TEntity> {
  if (!isPagePayload(raw)) throw new StorageError(UNEXPECTED_RESPONSE, 'failure')
  return { items: raw.items.map((item) => parseEntity(schema, item)), total: raw.total }
}

/**
 * The fields of a request body. The owner and the id are never sent: the API
 * takes the teacher from the token and the id from the path, and a body that
 * named either could only be wrong.
 */
export function withoutOwner(input: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'teacherId' && key !== 'id'))
}

/**
 * The body of a PATCH: only the fields the caller passed, and a field set to
 * `undefined` goes as `null`, because JSON drops `undefined` and the API reads
 * `null` as "clear this field". A create has nothing to clear, so its body
 * keeps `undefined`, which JSON leaves out.
 */
export function toPatchBody(input: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(withoutOwner(input)).map(([key, value]) => [key, value === undefined ? null : value]),
  )
}

/**
 * The query the API reads for a list. `ListParams` is the common part, and
 * `extraQuery` lets a resource add its own filters without this module
 * knowing their names. A filter left unset stays out of the URL.
 */
function listQuery<TParams extends ListParams>(
  params: TParams | undefined,
  extraQuery?: (params: TParams) => QueryParams,
): QueryParams {
  if (params === undefined) return {}
  const { search, archived, page, pageSize } = params
  return {
    search: search === '' ? undefined : search,
    archived,
    page,
    pageSize,
    ...(extraQuery?.(params) ?? {}),
  }
}

/**
 * Builds the HTTP version of a teacher-owned, archivable repository, the same
 * contract as `createOwnedRepository`. The teacher is not a parameter: the API
 * scopes every request by the token, so there is nothing to filter here.
 *
 * `TParams` extends `ListParams` so a resource with extra filters (such as
 * `QuestionListParams`) can send them through `extraQuery` without this
 * generic having to know their names. The default keeps every existing
 * repository compiling unchanged.
 */
export function createHttpOwnedRepository<
  TEntity,
  TInput extends object,
  TParams extends ListParams = ListParams,
>({
  api,
  resource,
  schema,
  archiveRoute = 'patch-archive',
  extraQuery,
}: HttpRepositoryConfig<TEntity, TParams>): OwnedRepository<TEntity, TInput, TParams> {
  const itemPath = (id: string) => `${resource}/${encodeURIComponent(id)}`

  return {
    async list(params?: TParams) {
      return parsePage(
        schema,
        await api.request('GET', resource, { query: listQuery(params, extraQuery) }),
      )
    },

    /** A 404 is an answer here, not a failure: detail screens show "not found" from it. */
    async getById(id) {
      try {
        return parseEntity(schema, await api.request('GET', itemPath(id)))
      } catch (error) {
        if (error instanceof StorageError && error.code === 'not-found') return null
        throw error
      }
    },

    async create(input) {
      return parseEntity(schema, await api.request('POST', resource, { body: withoutOwner(input) }))
    },

    async update(id, input) {
      return parseEntity(schema, await api.request('PATCH', itemPath(id), { body: toPatchBody(input) }))
    },

    async archive(id) {
      if (archiveRoute === 'delete') await api.request('DELETE', itemPath(id))
      else await api.request('PATCH', `${itemPath(id)}/archive`)
    },

    async restore(id) {
      await api.request('PATCH', `${itemPath(id)}/restore`)
    },
  }
}