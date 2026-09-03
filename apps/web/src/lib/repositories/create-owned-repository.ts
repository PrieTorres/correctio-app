import type { Archivable, OwnedByTeacher } from '@/types/domain';
import { compareByLocale, createId, matchesSearch } from '@/lib/utils';
import type { Collection } from '@/lib/storage/collection';
import { simulateLatency } from '@/lib/storage/collection';
import { StorageError } from '@/lib/storage/errors';
import type { OwnedRepository, Page, ListParams } from './types';

interface Config<TEntity, TInput> {
  collection: Collection<TEntity>;
  ownerId: string;
  /** Human label used in error messages, e.g. "Turma". */
  label: string;
  /** Builds the persisted entity from validated form input. */
  toEntity: (input: TInput, base: { id: string; ownerId: string }) => TEntity;
  /** Fields the free-text search looks at. */
  searchableFields: (entity: TEntity) => string[];
  /** Value used to sort listings. */
  sortKey: (entity: TEntity) => string;
}

type Entity = Archivable & OwnedByTeacher & { id: string };

/**
 * Builds a repository for any owner-scoped, archivable entity.
 *
 * Classes, exams and applications share the same persistence shape, so they
 * share this factory instead of three near-identical files.
 *
 * Scoping every read by `ownerId` has no security value while the data lives
 * in the visitor's browser. It exists so the signature already matches the
 * HTTP adapter, and so the server-side implementation cannot forget it.
 */
export function createOwnedRepository<TEntity extends Entity, TInput>({
  collection,
  ownerId,
  label,
  toEntity,
  searchableFields,
  sortKey,
}: Config<TEntity, TInput>): OwnedRepository<TEntity, TInput> {
  const readOwned = (): TEntity[] =>
    collection.readAll().filter((entity) => entity.ownerId === ownerId);

  const persist = (owned: TEntity[]): void => {
    const others = collection.readAll().filter((entity) => entity.ownerId !== ownerId);
    collection.writeAll([...others, ...owned]);
  };

  const requireIndex = (items: TEntity[], id: string): number => {
    const index = items.findIndex((entity) => entity.id === id);
    if (index === -1) throw new StorageError(`${label} não encontrada.`, 'not-found');
    return index;
  };

  const replaceAt = (items: TEntity[], index: number, next: TEntity): TEntity[] =>
    items.with(index, next);

  const setArchivedAt = async (id: string, archivedAt: string | null): Promise<void> => {
    await simulateLatency();
    const items = readOwned();
    const index = requireIndex(items, id);
    persist(replaceAt(items, index, { ...items[index]!, archivedAt }));
  };

  return {
    async list(params: ListParams = {}): Promise<Page<TEntity>> {
      await simulateLatency();

      const { search = '', includeArchived = false, page = 1, pageSize = 50 } = params;

      const matches = readOwned()
        .filter((entity) => (includeArchived ? entity.archivedAt !== null : entity.archivedAt === null))
        .filter((entity) => matchesSearch(search, ...searchableFields(entity)))
        .toSorted((a, b) => compareByLocale(sortKey(a), sortKey(b)));

      const start = (page - 1) * pageSize;
      return { items: matches.slice(start, start + pageSize), total: matches.length };
    },

    async getById(id: string): Promise<TEntity | null> {
      await simulateLatency();
      return readOwned().find((entity) => entity.id === id) ?? null;
    },

    async create(input: TInput): Promise<TEntity> {
      await simulateLatency();
      const entity = toEntity(input, { id: createId(), ownerId });
      persist([...readOwned(), entity]);
      return entity;
    },

    async update(id: string, input: Partial<TInput>): Promise<TEntity> {
      await simulateLatency();
      const items = readOwned();
      const index = requireIndex(items, id);
      const next = { ...items[index]!, ...input } as TEntity;
      persist(replaceAt(items, index, next));
      return next;
    },

    archive: (id) => setArchivedAt(id, new Date().toISOString()),
    restore: (id) => setArchivedAt(id, null),
  };
}
