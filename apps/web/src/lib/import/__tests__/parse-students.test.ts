import { describe, expect, it } from 'vitest'
import { parseStudents } from '../parse-students'

describe('parseStudents', () => {
  it('reads a comma-separated list', () => {
    const { students } = parseStudents('Ana Ribeiro,202601\nBruno Lima,202602')

    expect(students).toEqual([
      { fullName: 'Ana Ribeiro', registration: '202601' },
      { fullName: 'Bruno Lima', registration: '202602' },
    ])
  })

  /** A spreadsheet saved in a Brazilian locale uses semicolons. */
  it('reads a semicolon-separated list', () => {
    const { students } = parseStudents('Ana Ribeiro;202601')

    expect(students[0]?.registration).toBe('202601')
  })

  it('reads a tab-separated list, which is what pasting from a sheet gives', () => {
    const { students } = parseStudents('Ana Ribeiro\t202601')

    expect(students[0]?.fullName).toBe('Ana Ribeiro')
  })

  it('takes the e-mail when the list carries one', () => {
    const { students } = parseStudents('Ana,202601,ana@exemplo.edu.br')

    expect(students[0]?.email).toBe('ana@exemplo.edu.br')
  })

  it('leaves the e-mail out rather than storing an empty one', () => {
    const { students } = parseStudents('Ana,202601,')

    expect(students[0]?.email).toBeUndefined()
  })

  it('skips the header row a spreadsheet export brings', () => {
    const { students, problems } = parseStudents('Nome,Matrícula\nAna,202601')

    expect(students).toHaveLength(1)
    expect(problems).toEqual([])
  })

  it('ignores blank lines instead of reporting them', () => {
    const { students, problems } = parseStudents('Ana,202601\n\n\nBruno,202602\n')

    expect(students).toHaveLength(2)
    expect(problems).toEqual([])
  })

  it('trims the spaces a paste leaves behind', () => {
    const { students } = parseStudents('  Ana Ribeiro ,  202601  ')

    expect(students[0]).toEqual({ fullName: 'Ana Ribeiro', registration: '202601' })
  })

  /** Forty students with one bad row should bring in thirty-nine. */
  it('keeps the good lines and reports the bad one, with its number', () => {
    const { students, problems } = parseStudents('Ana,202601\nsó um nome\nBruno,202602')

    expect(students).toHaveLength(2)
    expect(problems).toEqual([{ line: 2, reason: 'Faltou a matrícula nesta linha.' }])
  })

  it('reports a missing name', () => {
    const { problems } = parseStudents(',202601')

    expect(problems[0]?.reason).toContain('nome')
  })

  it('reports a missing registration', () => {
    const { problems } = parseStudents('Ana,')

    expect(problems[0]?.reason).toContain('matrícula')
  })

  it('reports a registration repeated inside the list', () => {
    const { students, problems } = parseStudents('Ana,202601\nBruno,202601')

    expect(students).toHaveLength(1)
    expect(problems[0]?.reason).toContain('repetida')
  })

  it('reads nothing from nothing, without failing', () => {
    expect(parseStudents('')).toEqual({ students: [], problems: [] })
  })
})
