import { createLocalClassRepository, type ClassRepository } from './class-repository'
import { createLocalStudentRepository, type StudentRepository } from './student-repository'

export * from './types'
export type { ClassRepository, StudentRepository }

export interface Repositories {
  classes: ClassRepository
  students: StudentRepository
}

/**
 * The single place that knows where data comes from.
 *
 * Swapping `localStorage` for the HTTP adapter happens here and nowhere else;
 * no screen, hook or schema changes.
 */
export function createRepositories(ownerId: string): Repositories {
  return {
    classes: createLocalClassRepository(ownerId),
    students: createLocalStudentRepository(),
  }
}
