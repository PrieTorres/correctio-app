import { describe, expect, it } from 'vitest'
import { buildPath, ROUTES } from '../routes'

describe('buildPath', () => {
  it('fills a single parameter', () => {
    expect(buildPath(ROUTES.classDetail, { id: 'abc' })).toBe('/turmas/abc')
  })

  it('fills every parameter of a nested route', () => {
    expect(buildPath(ROUTES.gradingSheet, { id: 'a1', sheetId: 's9' })).toBe(
      '/aplicacoes/a1/corrigir/s9',
    )
  })

  it('accepts numbers', () => {
    expect(buildPath('/folhas/:number', { number: 37 })).toBe('/folhas/37')
  })

  it('leaves a template without parameters untouched', () => {
    expect(buildPath(ROUTES.classes, {})).toBe('/turmas')
  })

  it('keeps placeholders it was not given a value for', () => {
    expect(buildPath(ROUTES.gradingSheet, { id: 'a1' })).toContain(':sheetId')
  })
})

describe('ROUTES', () => {
  it('keeps the public lookup path stable, since it is printed inside the QR code', () => {
    expect(ROUTES.publicLookup).toBe('/r/:code')
  })

  it('has no duplicate paths', () => {
    const paths = Object.values(ROUTES)
    expect(new Set(paths).size).toBe(paths.length)
  })
})
