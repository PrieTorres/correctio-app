import { compareByLocale, createId, matchesSearch } from '@/lib/utils'
import type { Collection } from '@/lib/storage/collection'
import { simulateLatency } from '@/lib/storage/collection'
import { StorageError } from '@/lib/storage/errors'
import type { ListParams, OwnedRepository, Page } from './types'

interface OwnedEntity {
  id: string
  teacherId: string
}

/**
 * How an entity records that it is out of circulation.
 *
 * The specification is not uniform about this: `Class`, `Exam` and
 * `Application` carry a status enum, while `Question` carries a `deletedAt`
 * timestamp. Both are soft deletes, so the difference is spelling rather than
 * behaviour, and it stays here instead of forcing a second repository.
 */
export interface ArchivingStrategy<TEntity> {
  isArchived: (entity: TEntity) => boolean
  setArchived: (entity: TEntity, archived: boolean) => TEntity
}

/** For entities the specification gives a status enum. */
export function archiveByStatus<TEntity extends { status: string }>(
  active: TEntity['status'],
  archived: TEntity['status'],
): ArchivingStrategy<TEntity> {
  return {
    isArchived: (entity) => entity.status === archived,
    setArchived: (entity, isArchived) => ({ ...entity, status: isArchived ? archived : active }),
  }
}

/** For entities the specification gives a nullable timestamp. */
export function archiveByTimestamp<TEntity, TKey extends keyof TEntity>(
  field: TKey,
): ArchivingStrategy<TEntity> {
  return {
    isArchived: (entity) => entity[field] !== undefined,
    setArchived: (entity, isArchived) => ({
      ...entity,
      [field]: isArchived ? new Date().toISOString() : undefined,
    }),
  }
}

interface Config<TEntity extends OwnedEntity, TInput> {
  collection: Collection<TEntity>
  teacherId: string
  /** Label used in user-facing error messages. */
  label: string
  archiving: ArchivingStrategy<TEntity>
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
  archiving,
  toEntity,
  searchableFields,
  sortKey,
}: Config<TEntity, TInput>): OwnedRepository<TEntity, TInput> {
  const readOwned = (): TEntity[] =>
    collection.readAll().filter((entity) => entity.teacherId === teacherId)

  const persist = (owned: TEntity[]): void => {
    const others = collection.readAll().filter((entity) => entity.teacherId !== teacherId)
    collection.writeAll([...others, ...owned])
  }

  const requireEntry = (items: TEntity[], id: string): [index: number, entity: TEntity] => {
    const index = items.findIndex((entity) => entity.id === id)
    const entity = items[index]
    if (entity === undefined) throw new StorageError(`${label} não encontrada.`, 'not-found')
    return [index, entity]
  }

  const setArchived = async (id: string, archived: boolean): Promise<void> => {
    await simulateLatency()
    const items = readOwned()
    const [index, entity] = requireEntry(items, id)
    persist(items.with(index, archiving.setArchived(entity, archived)))
  }

  return {
    async list(params: ListParams = {}): Promise<Page<TEntity>> {
      await simulateLatency()

      const { search = '', archived = false, page = 1, pageSize = 50 } = params

      const matches = readOwned()
        .filter((entity) => archiving.isArchived(entity) === archived)
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
      const [index, entity] = requireEntry(items, id)
      const next = { ...entity, ...input } as TEntity
      persist(items.with(index, next))
      return next
    },

    archive: (id) => setArchived(id, true),
    restore: (id) => setArchived(id, false),
  }
}
