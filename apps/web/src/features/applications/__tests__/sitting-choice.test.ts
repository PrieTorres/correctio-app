import { describe, expect, it } from 'vitest'
import { initialSittingOf, newApplicationPath } from '../sitting-choice'

const choices = { exams: [{ id: 'e1' }, { id: 'e2' }], classes: [{ id: 'c1' }, { id: 'c2' }] }

describe('newApplicationPath', () => {
  it('names the exam or the class to choose in advance, or nothing', () => {
    expect(newApplicationPath()).toBe('/aplicacoes/nova')
    expect(newApplicationPath({ examId: 'e1' })).toBe('/aplicacoes/nova?prova=e1')
    expect(newApplicationPath({ classId: 'c2' })).toBe('/aplicacoes/nova?turma=c2')
  })
})

describe('initialSittingOf', () => {
  it('opens with what the link named', () => {
    expect(initialSittingOf(choices, new URLSearchParams('prova=e2&turma=c1'))).toEqual({ examId: 'e2', classId: 'c1' })
  })

  it('leaves the choice to the teacher when there are several and the link named none', () => {
    expect(initialSittingOf(choices, new URLSearchParams())).toEqual({ examId: '', classId: '' })
  })

  it('chooses the only exam or class there is', () => {
    expect(initialSittingOf({ exams: [{ id: 'e1' }], classes: choices.classes }, new URLSearchParams())).toEqual({ examId: 'e1', classId: '' })
  })

  /** An exam archived since the link was made is no longer a choice; the server would refuse it anyway. */
  it('ignores a link to something that is no longer a choice', () => {
    expect(initialSittingOf(choices, new URLSearchParams('prova=archived'))).toEqual({ examId: '', classId: '' })
    expect(initialSittingOf({ exams: [{ id: 'e1' }], classes: [] }, new URLSearchParams('prova=archived'))).toEqual({ examId: 'e1', classId: '' })
  })
})
