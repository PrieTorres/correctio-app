import { describe, expect, it } from 'vitest'
import { TOUR_LIMITS, TOUR_STEPS } from '../content'

const screens = Object.entries(TOUR_STEPS)

/**
 * The limits come from `docs/Tour_Guiado.md`, and they exist for a reason worth
 * repeating: more than four steps and nobody finishes, more than ninety
 * characters and the step wraps into a paragraph on a phone.
 */
describe('tour content', () => {
  it('covers the screens the document says have a tour', () => {
    expect(screens).toHaveLength(16)
  })

  it.each(screens)('keeps %s within four steps', (_screen, steps) => {
    expect(steps.length).toBeLessThanOrEqual(TOUR_LIMITS.maxSteps)
  })

  it.each(screens)('gives %s at least one step', (_screen, steps) => {
    expect(steps.length).toBeGreaterThan(0)
  })

  it('keeps every step within ninety characters', () => {
    const tooLong = screens.flatMap(([screen, steps]) =>
      steps
        .filter((step) => step.length > TOUR_LIMITS.maxCharacters)
        .map((step) => `${screen}: ${step.length} caracteres — ${step}`),
    )

    expect(tooLong).toEqual([])
  })

  it('starts every step with a capital letter, since each is a sentence', () => {
    const lowercase = screens.flatMap(([screen, steps]) =>
      steps.filter((step) => step[0] !== step[0]?.toLocaleUpperCase('pt-BR')).map((step) => `${screen}: ${step}`),
    )

    expect(lowercase).toEqual([])
  })

  it('never repeats a step inside one screen', () => {
    for (const [, steps] of screens) {
      expect(new Set(steps).size).toBe(steps.length)
    }
  })
})
