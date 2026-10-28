import type { ParsedStudent } from './parse-students'

export interface SeparatedStudents {
  toImport: ParsedStudent[]
  alreadyInClass: ParsedStudent[]
}

/**
 * The database compares registrations case-insensitively and ignores the
 * padding a spreadsheet leaves around them, so the preview has to compare the
 * same way or it would call "ab1" new while the server skips it.
 */
const normalize = (registration: string) => registration.trim().toLowerCase()

/**
 * Splits a parsed list into the students the import will create and the ones
 * whose registration the class already holds.
 *
 * The server skips the second group on its own, but only after the teacher
 * confirmed a count that included them. Telling them apart in the preview keeps
 * the number on the button equal to the number that comes in.
 */
export function separateRegistered(
  students: readonly ParsedStudent[],
  takenRegistrations: readonly string[],
): SeparatedStudents {
  const taken = new Set(takenRegistrations.map(normalize))
  const toImport: ParsedStudent[] = []
  const alreadyInClass: ParsedStudent[] = []

  students.forEach((student) => {
    ;(taken.has(normalize(student.registration)) ? alreadyInClass : toImport).push(student)
  })

  return { toImport, alreadyInClass }
}
