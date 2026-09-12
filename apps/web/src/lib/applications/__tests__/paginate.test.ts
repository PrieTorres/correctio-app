import { describe, expect, it } from 'vitest'
import { paginate } from '../paginate'

const block = (id: string, height: number) => ({ id, height })
const ids = (pages: { id: string }[][]) => pages.map((page) => page.map((item) => item.id))

describe('paginate', () => {
  it('puts everything that fits on one page', () => {
    const { pages } = paginate([block('a', 30), block('b', 30)], 100)

    expect(ids(pages)).toEqual([['a', 'b'], []])
  })

  /** RF43: it goes whole to the next page rather than being split. */
  it('moves a block that does not fit to the next page, entire', () => {
    const { pages } = paginate([block('a', 60), block('b', 50)], 100)

    expect(ids(pages)).toEqual([['a'], ['b']])
  })

  it('leaves the empty space rather than filling it with part of a block', () => {
    const { pages } = paginate([block('a', 90), block('b', 20), block('c', 20)], 100)

    expect(ids(pages)).toEqual([['a'], ['b', 'c']])
  })

  it('fills a page exactly when the heights add up', () => {
    const { pages } = paginate([block('a', 50), block('b', 50), block('c', 10)], 100)

    expect(ids(pages)).toEqual([['a', 'b'], ['c']])
  })

  it('keeps a block taller than the page rather than dropping the question', () => {
    const { pages } = paginate([block('huge', 240)], 100)

    expect(ids(pages)).toEqual([['huge'], []])
  })

  /** RF44: so the next exam does not start on the back of this one. */
  it('adds a blank page when the total is odd', () => {
    const { pages, blankPageAdded } = paginate([block('a', 10)], 100)

    expect(blankPageAdded).toBe(true)
    expect(pages).toHaveLength(2)
    expect(pages[1]).toEqual([])
  })

  it('adds nothing when the total is already even', () => {
    const { pages, blankPageAdded } = paginate([block('a', 60), block('b', 60)], 100)

    expect(blankPageAdded).toBe(false)
    expect(pages).toHaveLength(2)
  })

  it('produces no pages at all for no blocks, and no blank one either', () => {
    const { pages, blankPageAdded } = paginate([], 100)

    expect(pages).toEqual([])
    expect(blankPageAdded).toBe(false)
  })

  it('refuses a page with no usable height instead of looping forever', () => {
    const { pages } = paginate([block('a', 10)], 0)

    expect(pages).toEqual([])
  })

  it('never splits a block across two pages', () => {
    const blocks = Array.from({ length: 17 }, (_, index) => block(`q${index}`, 23))

    const { pages } = paginate(blocks, 100)

    const placed = pages.flat().map((item) => item.id)
    expect(placed).toHaveLength(17)
    expect(new Set(placed).size).toBe(17)
  })
})
