import type { Class } from '@/types/domain'
import type { ClassInput } from '@/lib/schemas'
import { classSchema } from '@/lib/schemas'
import { createCollection } from '@/lib/storage/collection'
import { createInviteCode } from '@/lib/utils'
import { archiveByStatus, createOwnedRepository } from './create-owned-repository'
import type { ApiClient } from './http/api-client'
import { createHttpOwnedRepository } from './http/create-http-repository'
import type { OwnedRepository } from './types'

export type ClassRepository = OwnedRepository<Class, ClassInput>

export function createLocalClassRepository(teacherId: string): ClassRepository {
  return createOwnedRepository<Class, ClassInput>({
    collection: createCollection('classes', classSchema),
    teacherId,
    label: 'Turma',
    archiving: archiveByStatus<Class>('active', 'archived'),
    toEntity: (input, base) => ({
      ...base,
      ...input,
      status: 'active',
      inviteCode: createInviteCode(),
    }),
    searchableFields: (item) => [item.name, item.subject],
    sortKey: (item) => item.name,
    /** The same name in the same term is the same class, typed twice. */
    identity: (item) => `${item.name}|${item.term}`,
  })
}

/**
 * The classes of the API (#41). Search, the archive filter and paging run on
 * the server, and the duplicate check answers 409 with the same messages the
 * local version gives.
 */
export function createHttpClassRepository(api: ApiClient): ClassRepository {
  return createHttpOwnedRepository<Class, ClassInput>({ api, resource: '/classes', schema: classSchema })
}
