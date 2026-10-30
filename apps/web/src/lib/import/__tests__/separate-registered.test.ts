import { describe, expect, it } from 'vitest'
import { separateRegistered } from '../separate-registered'

const ana = { fullName: 'Ana Ribeiro', registration: '202601' }
const bruno = { fullName: 'Bruno Lima', registration: '202602' }
const caio = { fullName: 'Caio Souza', registration: 'AB1' }

describe('separateRegistered', () => {
  it('keeps everyone when the class holds none of the registrations', () => {
    expect(separateRegistered([ana, bruno], ['999'])).toEqual({ toImport: [ana, bruno], alreadyInClass: [] })
  })

  it('leaves out the student whose registration the class already holds', () => {
    expect(separateRegistered([ana, bruno], ['202601'])).toEqual({ toImport: [bruno], alreadyInClass: [ana] })
  })

  it('keeps the order of the pasted list in both groups', () => {
    const result = separateRegistered([ana, bruno, caio], ['AB1', '202601'])

    expect(result.toImport).toEqual([bruno])
    expect(result.alreadyInClass).toEqual([ana, caio])
  })

  /** The database compares registrations case-insensitively, so the preview must not call "ab1" new. */
  it('compares ignoring case and the padding around the registration', () => {
    expect(separateRegistered([caio], [' ab1 '])).toEqual({ toImport: [], alreadyInClass: [caio] })
  })

  it('has nothing to separate in an empty list', () => {
    expect(separateRegistered([], ['202601'])).toEqual({ toImport: [], alreadyInClass: [] })
  })
})
