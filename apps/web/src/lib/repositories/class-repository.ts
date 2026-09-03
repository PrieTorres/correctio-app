import type { Class } from '@/types/domain'
import type { ClassInput } from '@/lib/schemas'
import { classSchema } from '@/lib/schemas'
import { createCollection } from '@/lib/storage/collection'
import { createOwnedRepository } from './create-owned-repository'
import type { OwnedRepository } from './types'

export type ClassRepository = OwnedRepository<Class, ClassInput>

export function createLocalClassRepository(ownerId: string): ClassRepository {
  return createOwnedRepository<Class, ClassInput>({
    collection: createCollection('classes', classSchema),
    ownerId,
    label: 'Turma',
    toEntity: (input, base) => ({ ...base, ...input, archivedAt: null }),
    searchableFields: (item) => [item.name, item.subject],
    sortKey: (item) => item.name,
  })
}
