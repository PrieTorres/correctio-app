import { describe, expect, it } from 'vitest'
import { describeImport, describeReady, studentCount } from '../describe-import'

describe('studentCount', () => {
  it('counts one student in the singular and any other number in the plural', () => {
    expect(studentCount(1)).toBe('1 aluno')
    expect(studentCount(0)).toBe('0 alunos')
    expect(studentCount(40)).toBe('40 alunos')
  })
})

describe('describeReady', () => {
  it('agrees the adjective with the count', () => {
    expect(describeReady(1)).toBe('1 aluno pronto para importar')
    expect(describeReady(3)).toBe('3 alunos prontos para importar')
  })
})

describe('describeImport', () => {
  it('counts what came in, in the plural', () => {
    expect(describeImport({ created: 38, skipped: 0 })).toEqual({ created: '38 alunos entraram na turma.' })
  })

  it('counts a single student in the singular', () => {
    expect(describeImport({ created: 1, skipped: 0 }).created).toBe('1 aluno entrou na turma.')
  })

  it('says plainly when nothing new came in', () => {
    expect(describeImport({ created: 0, skipped: 3 }).created).toBe('Nenhum aluno novo entrou na turma.')
  })

  /** The skipped line is the only place the teacher learns that part of the list did not come in. */
  it('says why the skipped students were left out', () => {
    expect(describeImport({ created: 38, skipped: 2 }).skipped).toBe(
      '2 foram ignorados porque a matrícula já estava na turma.',
    )
    expect(describeImport({ created: 1, skipped: 1 }).skipped).toBe(
      '1 foi ignorado porque a matrícula já estava na turma.',
    )
  })

  it('has no skipped line when nothing was skipped', () => {
    expect(describeImport({ created: 4, skipped: 0 })).not.toHaveProperty('skipped')
  })
})
