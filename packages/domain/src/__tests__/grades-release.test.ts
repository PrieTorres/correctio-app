import { describe, expect, it } from 'vitest'
import { canReleaseGrades } from '../grades-release'

const generated = { status: 'generated' } as const

describe('canReleaseGrades', () => {
  it('releases once every printed version has its answer key published', () => {
    expect(canReleaseGrades(generated, { versions: 2, publishedAnswerKeys: 2 })).toEqual({ allowed: true })
  })

  /** RF46: a grade never shows without the key that explains it. */
  it('waits for the answer key of every version', () => {
    expect(canReleaseGrades(generated, { versions: 2, publishedAnswerKeys: 1 })).toEqual({
      allowed: false,
      reason: 'Publique o gabarito de todas as versões antes de liberar as notas.',
    })
  })

  it('refuses an application with nothing printed, which has no key at all', () => {
    expect(canReleaseGrades({ status: 'draft' }, { versions: 0, publishedAnswerKeys: 0 })).toEqual({
      allowed: false,
      reason: 'Gere a prova antes de liberar as notas.',
    })
  })

  it('refuses an archived application before anything else, and says to restore it', () => {
    expect(canReleaseGrades({ status: 'closed' }, { versions: 1, publishedAnswerKeys: 0 })).toEqual({
      allowed: false,
      reason: 'Esta aplicação está arquivada. Restaure a aplicação antes de liberar as notas.',
    })
  })
})
