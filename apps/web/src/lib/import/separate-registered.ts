import { registrationKey } from '@correctio/domain'
import type { ParsedStudent } from './parse-students'

export interface SeparatedStudents {
  toImport: ParsedStudent[]
  alreadyInClass: ParsedStudent[]
}

/**
 * Splits a parsed list into the students the import will create and the ones
 * whose registration the class already holds.
 *
 * The server skips the second group on its own, but only after the teacher
 * confirmed a count that included them. Telling them apart in the preview keeps
 * the number on the button equal to the number that comes in, which is why it
 * compares with `registrationKey`, the rule of the API's import.
 */
export function separateRegistered(
  students: readonly ParsedStudent[],
  takenRegistrations: readonly string[],
): SeparatedStudents {
  const taken = new Set(takenRegistrations.map(registrationKey))
  const toImport: ParsedStudent[] = []
  const alreadyInClass: ParsedStudent[] = []

  students.forEach((student) => {
    ;(taken.has(registrationKey(student.registration)) ? alreadyInClass : toImport).push(student)
  })

  return { toImport, alreadyInClass }
}
