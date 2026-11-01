import { describe, expect, it } from 'vitest'
import { isDuplicateEntry } from '../errors'

const duplicate = { code: 'ER_DUP_ENTRY', sqlMessage: "Duplicate entry 'ABCDEFGH' for key 'classes.inviteCode'" }

describe('isDuplicateEntry', () => {
  it('recognises a row refused by a unique index', () => {
    expect(isDuplicateEntry(duplicate)).toBe(true)
  })

  it('tells which index refused it', () => {
    expect(isDuplicateEntry(duplicate, 'inviteCode')).toBe(true)
    expect(isDuplicateEntry(duplicate, 'uq_students_class_registration')).toBe(false)
    expect(isDuplicateEntry({ code: 'ER_DUP_ENTRY' }, 'inviteCode')).toBe(false)
  })

  /** Every table calls its primary key `PRIMARY`, so only the table says whose it is. */
  it('tells primary keys apart by their table', () => {
    const tagKey = { code: 'ER_DUP_ENTRY', sqlMessage: "Duplicate entry 'q1-integrais' for key 'question_tags.PRIMARY'" }

    expect(isDuplicateEntry(tagKey, 'question_tags.PRIMARY')).toBe(true)
    expect(isDuplicateEntry(tagKey, 'question_alternatives.PRIMARY')).toBe(false)
  })

  it('leaves every other failure alone', () => {
    expect(isDuplicateEntry(new Error('Connection lost'))).toBe(false)
    expect(isDuplicateEntry({ code: 'ER_NO_REFERENCED_ROW_2' })).toBe(false)
    expect(isDuplicateEntry(null)).toBe(false)
    expect(isDuplicateEntry('ER_DUP_ENTRY')).toBe(false)
  })
})
