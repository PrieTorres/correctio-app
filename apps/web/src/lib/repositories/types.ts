export interface Page<T> {
  items: T[]
  total: number
}

export interface ListParams {
  search?: string
  page?: number
  pageSize?: number
  /**
   * Which side of the archive to list: the active records by default, the
   * archived ones when set. It selects rather than adds, because every screen
   * showing these is a two-way filter and never a combined list.
   */
  archived?: boolean
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
