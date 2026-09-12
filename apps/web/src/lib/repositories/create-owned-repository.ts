import { compareByLocale, createId, matchesSearch, normalize } from '@/lib/utils'
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
  /** `desc` puts the newest first, for listings ordered by when, not by name. */
  sortDirection?: 'asc' | 'desc'
  /**
   * What makes two records the same one to a teacher, compared without
   * accents or case. Leaving it out means duplicates are allowed.
   */
  identity?: (entity: TEntity) => string
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
  sortDirection = 'asc',
  identity,
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

  /**
   * Refuses a record a teacher would read as one they already have.
   *
   * Compared without accents or case, because "Cálculo I" and "calculo i" are
   * the same class to the person typing them. Archived records count: a name
   * that is free only because something was archived is not free, and saying so
   * points at the restore instead of leaving two of the same thing in the list.
   */
  const requireUnique = (candidate: TEntity, items: readonly TEntity[]): void => {
    if (identity === undefined) return

    const wanted = normalize(identity(candidate))
    const clash = items.find(
      (entity) => entity.id !== candidate.id && normalize(identity(entity)) === wanted,
    )
    if (clash === undefined) return

    throw new StorageError(
      archiving.isArchived(clash)
        ? `Já existe uma ${label.toLocaleLowerCase('pt-BR')} arquivada com estes dados. Restaure em vez de criar outra.`
        : `Já existe uma ${label.toLocaleLowerCase('pt-BR')} com estes dados.`,
      'conflict',
    )
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
        .toSorted((a, b) =>
          sortDirection === 'desc'
            ? compareByLocale(sortKey(b), sortKey(a))
            : compareByLocale(sortKey(a), sortKey(b)),
        )

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

      const items = readOwned()
      requireUnique(entity, items)
      persist([...items, entity])
      return entity
    },

    async update(id: string, input: Partial<TInput>): Promise<TEntity> {
      await simulateLatency()
      const items = readOwned()
      const [index, entity] = requireEntry(items, id)
      const next = { ...entity, ...input } as TEntity

      requireUnique(next, items)
      persist(items.with(index, next))
      return next
    },

    archive: (id) => setArchived(id, true),
    restore: (id) => setArchived(id, false),
  }
}
