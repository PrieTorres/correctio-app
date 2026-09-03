export interface Page<T> {
  items: T[]
  total: number
}

export interface ListParams {
  search?: string
  page?: number
  pageSize?: number
  /** Listings hide archived records unless this is set. */
  includeArchived?: boolean
}

/**
 * Contract every repository implements, shaped after the future HTTP API:
 * asynchronous, paginated, owner-scoped, with a single error type.
 *
 * `archive`/`restore` replace deletion — records leave the listing but are
 * never destroyed.
 */
export interface OwnedRepository<TEntity, TInput> {
  list: (params?: ListParams) => Promise<Page<TEntity>>
  getById: (id: string) => Promise<TEntity | null>
  create: (input: TInput) => Promise<TEntity>
  update: (id: string, input: Partial<TInput>) => Promise<TEntity>
  archive: (id: string) => Promise<void>
  restore: (id: string) => Promise<void>
}
