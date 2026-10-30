import type { Migration } from 'kysely'
import * as initialSchema from './0001-initial-schema'
import * as authentication from './0002-authentication'
import * as answerCardVersion from './0003-answer-card-version'

/**
 * Listed by hand instead of read from the folder, so the same list works in the
 * tests, under `tsx` and in a bundle. The key orders the migrations: a new one
 * takes the next number and is never renamed once merged.
 */
export const MIGRATIONS: Readonly<Record<string, Migration>> = {
  '0001-initial-schema': initialSchema,
  '0002-authentication': authentication,
  '0003-answer-card-version': answerCardVersion,
}
