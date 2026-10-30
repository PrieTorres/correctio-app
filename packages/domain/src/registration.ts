import { collationKey } from './collation'

/**
 * How two registrations are compared, the way the unique index of `students`
 * compares them (`collationKey`).
 *
 * Shared because the import preview of the web app and the import of the API
 * must agree on who is already in the class: when they disagree, the button
 * promises one count and the server creates another (#144).
 */
export function registrationKey(registration: string): string {
  return collationKey(registration)
}
