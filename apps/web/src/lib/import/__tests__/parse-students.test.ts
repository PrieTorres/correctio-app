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

  /** The API would skip the second row as the same registration, so the preview reports it now. */
  it('reports as repeated a registration that differs only in case or accents', () => {
    const { students, problems } = parseStudents('Ana,AB1\nBruno,áb1')

    expect(students).toHaveLength(1)
    expect(problems[0]?.reason).toContain('repetida')
  })

  it('reads nothing from nothing, without failing', () => {
    expect(parseStudents('')).toEqual({ students: [], problems: [] })
  })

  /**
   * The API checks every row with `studentInputSchema` and refuses the whole
   * list over one it cannot store, so the preview has to point at that line
   * first, with the rest still coming in.
   */
  describe('the rules of the API, line by line', () => {
    it('reports a malformed e-mail and keeps the other lines', () => {
      const { students, problems } = parseStudents('Ana,202601,ana@exemplo.edu.br\nBruno,202602,bruno@\nCarla,202603')

      expect(students.map((student) => student.registration)).toEqual(['202601', '202603'])
      expect(problems).toEqual([{ line: 2, reason: 'E-mail inválido.' }])
    })

    it('reports a name longer than the API stores', () => {
      const { students, problems } = parseStudents(`${'a'.repeat(161)},202601`)

      expect(students).toEqual([])
      expect(problems).toEqual([{ line: 1, reason: 'O nome pode ter no máximo 160 caracteres.' }])
    })

    it('reports a registration longer than the API stores', () => {
      const { problems } = parseStudents(`Ana,${'1'.repeat(41)}`)

      expect(problems).toEqual([{ line: 1, reason: 'A matrícula pode ter no máximo 40 caracteres.' }])
    })

    /** A line refused for its e-mail never came in, so a later line with the same registration is not a repeat. */
    it('does not hold the registration of a refused line', () => {
      const { students, problems } = parseStudents('Ana,202601,ana@\nAna Beatriz,202601,ana@exemplo.edu.br')

      expect(students).toEqual([{ fullName: 'Ana Beatriz', registration: '202601', email: 'ana@exemplo.edu.br' }])
      expect(problems).toHaveLength(1)
    })

    it('accepts the longest values the API stores', () => {
      const { students, problems } = parseStudents(`${'a'.repeat(160)},${'1'.repeat(40)}`)

      expect(students).toHaveLength(1)
      expect(problems).toEqual([])
    })
  })
})
