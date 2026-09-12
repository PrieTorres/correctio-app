import { describe, expect, it } from 'vitest'
import { stepsOf, TOUR_LIMITS, TOUR_STEPS, type TourScreen } from '../content'

const screens = Object.keys(TOUR_STEPS) as TourScreen[]
const everyStep = screens.flatMap((screen) =>
  stepsOf(screen).map((step) => ({ screen, ...step })),
)

/**
 * The limits come from `docs/Tour_Guiado.md`, and they exist for a reason worth
 * repeating: more than four steps and nobody finishes, more than ninety
 * characters and the step wraps into a paragraph on a phone.
 */
describe('tour content', () => {
  it('covers the screens the document says have a tour', () => {
    expect(screens).toHaveLength(16)
  })

  it.each(screens)('keeps %s within four steps', (screen) => {
    expect(stepsOf(screen).length).toBeLessThanOrEqual(TOUR_LIMITS.maxSteps)
  })

  it.each(screens)('gives %s at least one step', (screen) => {
    expect(stepsOf(screen).length).toBeGreaterThan(0)
  })

  it('keeps every step within ninety characters', () => {
    const tooLong = everyStep
      .filter((step) => step.text.length > TOUR_LIMITS.maxCharacters)
      .map((step) => `${step.screen}: ${step.text.length} caracteres — ${step.text}`)

    expect(tooLong).toEqual([])
  })

  it('starts every step with a capital letter, since each is a sentence', () => {
    const lowercase = everyStep
      .filter((step) => step.text[0] !== step.text[0]?.toLocaleUpperCase('pt-BR'))
      .map((step) => `${step.screen}: ${step.text}`)

    expect(lowercase).toEqual([])
  })

  it('never repeats a step inside one screen', () => {
    for (const screen of screens) {
      const texts = stepsOf(screen).map((step) => step.text)
      expect(new Set(texts).size).toBe(texts.length)
    }
  })

  /**
   * A step that names nothing can only describe the screen in general, which
   * is fine once or twice but is not a guided tour. Most of them point.
   */
  it('points at an element in most of its steps', () => {
    const targeted = everyStep.filter((step) => step.target !== undefined)

    expect(targeted.length / everyStep.length).toBeGreaterThan(0.8)
  })

  it('never points at the same element twice in one screen', () => {
    for (const screen of screens) {
      const targets = stepsOf(screen)
        .map((step) => step.target)
        .filter((target): target is string => target !== undefined)

      expect(new Set(targets).size).toBe(targets.length)
    }
  })

  /** The attribute is written into markup, so it has to be usable in a selector. */
  it('uses a plain name for every target', () => {
    const odd = everyStep
      .map((step) => step.target)
      .filter((target) => target !== undefined && !/^[a-z][a-z-]*$/.test(target))

    expect(odd).toEqual([])
  })
})
