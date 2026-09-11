import type { Application } from '@/types/domain'
import type { ApplicationInput } from '@/lib/schemas'
import { applicationSchema } from '@/lib/schemas'
import { createCollection, simulateLatency } from '@/lib/storage/collection'
import { StorageError } from '@/lib/storage/errors'
import { archiveByStatus, createOwnedRepository } from './create-owned-repository'
import type { OwnedRepository } from './types'

/**
 * Two transitions the form cannot express, because neither is something the
 * teacher types: one is the consequence of printing, the other of deciding to
 * let students see their grades.
 */
export interface ApplicationRepository extends OwnedRepository<Application, ApplicationInput> {
  markGenerated: (id: string) => Promise<void>
  setGradesReleased: (id: string, released: boolean) => Promise<void>
}

/**
 * Restoring returns an application to `draft`, never to `generated`.
 *
 * `generated` says paper exists, which archiving does not undo. Bringing one
 * back as generated would promise sheets that may no longer match the exam.
 *
 * Sorted and searched by date: an application is an event, and what a teacher
 * looks for is the one from a given day rather than one with a given name.
 */
export function createLocalApplicationRepository(teacherId: string): ApplicationRepository {
  const collection = createCollection('applications', applicationSchema)

  const base = createOwnedRepository<Application, ApplicationInput>({
    collection,
    teacherId,
    label: 'Aplicação',
    archiving: archiveByStatus<Application>('draft', 'closed'),
    toEntity: (input, identity) => ({
      ...identity,
      ...input,
      status: 'draft',
      gradesReleased: false,
    }),
    searchableFields: (item) => [item.date],
    sortKey: (item) => item.date,
  })

  const change = (id: string, transform: (application: Application) => Application): void => {
    const all = collection.readAll()
    const index = all.findIndex((item) => item.id === id && item.teacherId === teacherId)
    const application = all[index]
    if (application === undefined) {
      throw new StorageError('Aplicação não encontrada.', 'not-found')
    }
    collection.writeAll(all.with(index, transform(application)))
  }

  return {
    ...base,

    async markGenerated(id) {
      await simulateLatency()
      change(id, (application) => ({ ...application, status: 'generated' }))
    },

    async setGradesReleased(id, released) {
      await simulateLatency()
      change(id, (application) => ({ ...application, gradesReleased: released }))
    },
  }
}
