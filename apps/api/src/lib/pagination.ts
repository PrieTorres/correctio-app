import { z, type ZodRawShape } from 'zod'
import { API_ERROR_CODE, ApiError } from './api-error'

export const DEFAULT_PAGE_SIZE = 50

/**
 * Several hooks in the web app still ask for `pageSize: 1000` to read
 * everything at once. A lower ceiling would hide records without any error, so
 * the ceiling matches what the front asks today and anything above it is
 * refused loudly rather than cut.
 */
export const MAX_PAGE_SIZE = 1000

/** The list shape the web app already reads (`Page` in `apps/web/src/lib/repositories/types.ts`). */
export interface Page<T> {
  items: T[]
  total: number
}

export interface PageRequest {
  page: number
  pageSize: number
  search: string
  archived: boolean
}

/** `?archived=true` is the string `"true"`; the schema turns it into a boolean, and refuses anything else. */
export const booleanParam = z.enum(['true', 'false']).transform((value) => value === 'true')

const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true')

const pageRequestSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  search: z.string().trim().default(''),
  archived: flag,
})

/** Names the parameter refused; the ceiling is worth repeating only to whoever went past it. */
function invalidListParameter(field: string): ApiError {
  const ceiling = field === 'pageSize' ? ` O máximo por página é ${MAX_PAGE_SIZE}.` : ''
  return new ApiError(API_ERROR_CODE.INVALID, `Parâmetro de lista inválido: ${field}.${ceiling}`)
}

/**
 * Reads the shared list parameters together with the filters of one entity,
 * such as `classId` for applications, so a wrong filter is refused like a
 * wrong page. Every filter in `filters` should be optional: one left out
 * lists everything.
 */
export function parseListRequest<Filters extends ZodRawShape>(query: unknown, filters: Filters) {
  const result = pageRequestSchema.extend(filters).safeParse(query)
  if (result.success) return result.data
  throw invalidListParameter(result.error.issues[0]?.path.join('.') ?? 'consulta')
}

/** Reads the shared list parameters from a query string, refusing what it cannot honour. */
export function parsePageRequest(query: unknown): PageRequest {
  return parseListRequest(query, {})
}

/** The `LIMIT`/`OFFSET` pair a repository needs for a page. */
export function pageWindow({ page, pageSize }: Pick<PageRequest, 'page' | 'pageSize'>): {
  limit: number
  offset: number
} {
  return { limit: pageSize, offset: (page - 1) * pageSize }
}
