import { compareByLocale, createId, matchesSearch } from '@/lib/utils'
import type { Collection } from '@/lib/storage/collection'
import { simulateLatency } from '@/lib/storage/collection'
import { StorageError } from '@/lib/storage/errors'
import type { ListParams, OwnedRepository, Page } from './types'

/**
 * Shape shared by every teacher-owned entity that can be archived.
 *
 * The specification models archiving as a `status` enum rather than a
 * timestamp, so that is what the factory works with.
 */
interface OwnedEntity {
  id: string
  teacherId: string
  status: string
}

interface Config<TEntity extends OwnedEntity, TInput> {
  collection: Collection<TEntity>
  teacherId: string
  /** Label used in user-facing error messages. */
  label: string
  /** Status values marking a record as live and as archived, in that order. */
  statuses: readonly [active: TEntity['status'], archived: TEntity['status']]
  toEntity: (input: TInput, base: { id: string; teacherId: string }) => TEntity
  searchableFields: (entity: TEntity) => string[]
  sortKey: (entity: TEntity) => string
}

/**
 * Builds a repository for any teacher-owned, archivable entity.
 *
 * Scoping every read by `teacherId` carries no security weight while the data
 * lives in the visitor's browser. It exists so the signature already matches
 * the HTTP adapter, and so the server implementation cannot forget it.
 */
export function createOwnedRepository<TEntity extends OwnedEntity, TInput>({
  collection,
  teacherId,
  label,
  statuses,
  toEntity,
  searchableFields,
  sortKey,
}: Config<TEntity, TInput>): OwnedRepository<TEntity, TInput> {
  const [ACTIVE, ARCHIVED] = statuses

  const readOwned = (): TEntity[] =>
    collection.readAll().filter((entity) => entity.teacherId === teacherId)

  const persist = (owned: TEntity[]): void => {
    const others = collection.readAll().filter((entity) => entity.teacherId !== teacherId)
    collection.writeAll([...others, ...owned])
  }

  const requireIndex = (items: TEntity[], id: string): number => {
    const index = items.findIndex((entity) => entity.id === id)
    if (index === -1) throw new StorageError(`${label} não encontrada.`, 'not-found')
    return index
  }

  const setStatus = async (id: string, status: TEntity['status']): Promise<void> => {
    await simulateLatency()
    const items = readOwned()
    const index = requireIndex(items, id)
    persist(items.with(index, { ...items[index]!, status }))
  }

  return {
    async list(params: ListParams = {}): Promise<Page<TEntity>> {
      await simulateLatency()

      const { search = '', includeArchived = false, page = 1, pageSize = 50 } = params
      const wanted = includeArchived ? ARCHIVED : ACTIVE

      const matches = readOwned()
        .filter((entity) => entity.status === wanted)
        .filter((entity) => matchesSearch(search, ...searchableFields(entity)))
        .toSorted((a, b) => compareByLocale(sortKey(a), sortKey(b)))

      const start = (page - 1) * pageSize
      return { items: matches.slice(start, start + pageSize), total: matches.length }
    },

    async getById(id: string): Promise<TEntity | null> {
      await simulateLatency()
      return readOwned().find((entity) => entity.id === id) ?? null
    },

    async create(input: TInput): Promise<TEntity> {
      await simulateLatency()
      const entity = toEntity(input, { id: createId(), teacherId })
      persist([...readOwned(), entity])
      return entity
    },

    async update(id: string, input: Partial<TInput>): Promise<TEntity> {
      await simulateLatency()
      const items = readOwned()
      const index = requireIndex(items, id)
      const next = { ...items[index]!, ...input } as TEntity
      persist(items.with(index, next))
      return next
    },

    archive: (id) => setStatus(id, ARCHIVED),
    restore: (id) => setStatus(id, ACTIVE),
  }
}
