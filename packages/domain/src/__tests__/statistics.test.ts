import { describe, expect, it } from 'vitest'
import { accuracyByTag, accuracyOf, distribute, summarise } from '../statistics'

describe('summarise', () => {
  /** The case that breaks a report opened before anyone is corrected. */
  it('answers with zeros for an empty list, never NaN', () => {
    const summary = summarise([])

    expect(summary).toEqual({
      count: 0,
      mean: 0,
      median: 0,
      standardDeviation: 0,
      lowest: 0,
      highest: 0,
    })
    expect(Number.isNaN(summary.mean)).toBe(false)
  })

  it('handles a single grade, where the deviation is zero', () => {
    expect(summarise([7])).toEqual({
      count: 1,
      mean: 7,
      median: 7,
      standardDeviation: 0,
      lowest: 7,
      highest: 7,
    })
  })

  it('averages the grades', () => {
    expect(summarise([4, 6, 8]).mean).toBe(6)
  })

  it('takes the middle grade as the median for an odd count', () => {
    expect(summarise([9, 1, 5]).median).toBe(5)
  })

  /** An even count has no middle, so the two around it are averaged. */
  it('averages the two middle grades for an even count', () => {
    expect(summarise([1, 4, 6, 9]).median).toBe(5)
  })

  it('reports the extremes regardless of the order given', () => {
    const summary = summarise([7, 2, 9, 4])

    expect(summary.lowest).toBe(2)
    expect(summary.highest).toBe(9)
  })

  it('computes the population deviation', () => {
    expect(summarise([2, 4, 4, 4, 5, 5, 7, 9]).standardDeviation).toBe(2)
  })

  it('does not leak a floating point tail into the mean', () => {
    expect(summarise([1, 2]).mean).toBe(1.5)
  })

  it('leaves the caller list untouched while sorting', () => {
    const scores = [3, 1, 2]

    summarise(scores)

    expect(scores).toEqual([3, 1, 2])
  })
})

describe('distribute', () => {
  it('counts the grades in each band', () => {
    const bands = distribute([1, 3, 5, 7, 9], 10, 5)

    expect(bands.map((band) => band.count)).toEqual([1, 1, 1, 1, 1])
  })

  /** Otherwise the highest possible grade falls off the end of the chart. */
  it('includes the maximum in the last band', () => {
    const bands = distribute([10], 10, 5)

    expect(bands[4]?.count).toBe(1)
  })

  it('puts a grade on a boundary in the band above', () => {
    const bands = distribute([2], 10, 5)

    expect(bands[0]?.count).toBe(0)
    expect(bands[1]?.count).toBe(1)
  })

  it('produces empty bands for no grades, rather than nothing', () => {
    const bands = distribute([], 10, 5)

    expect(bands).toHaveLength(5)
    expect(bands.every((band) => band.count === 0)).toBe(true)
  })

  it('refuses a maximum of zero instead of dividing by it', () => {
    expect(distribute([1], 0, 5)).toEqual([])
  })

  it('refuses zero bands', () => {
    expect(distribute([1], 10, 0)).toEqual([])
  })
})

describe('accuracyOf', () => {
  const results = [
    { questionId: 'q1', correct: true, selectedAlternativeId: 'a' },
    { questionId: 'q1', correct: false, selectedAlternativeId: 'b' },
    { questionId: 'q1', correct: false, selectedAlternativeId: 'b' },
    { questionId: 'q2', correct: true, selectedAlternativeId: 'x' },
  ]

  it('counts only the question asked about', () => {
    expect(accuracyOf('q1', results).answered).toBe(3)
  })

  it('reports the percentage of right answers', () => {
    expect(accuracyOf('q1', results).percentage).toBe(33.3)
  })

  /** A wrong alternative winning usually names the misconception. */
  it('reports the alternative most of the class marked', () => {
    expect(accuracyOf('q1', results).mostMarkedAlternativeId).toBe('b')
  })

  it('reports zero for a question nobody answered', () => {
    const accuracy = accuracyOf('ghost', results)

    expect(accuracy.answered).toBe(0)
    expect(accuracy.percentage).toBe(0)
    expect(accuracy.mostMarkedAlternativeId).toBeUndefined()
  })

  it('ignores blanks when deciding what was most marked', () => {
    const withBlanks = [
      { questionId: 'q1', correct: false },
      { questionId: 'q1', correct: true, selectedAlternativeId: 'a' },
    ]

    expect(accuracyOf('q1', withBlanks).mostMarkedAlternativeId).toBe('a')
  })
})

describe('accuracyByTag', () => {
  const tags: Record<string, string[]> = {
    q1: ['Limites', 'Cálculo'],
    q2: ['Limites'],
    q3: ['Matrizes'],
  }
  const tagsOf = (questionId: string) => tags[questionId] ?? []

  it('groups a question into every tag it carries', () => {
    const byTag = accuracyByTag([{ questionId: 'q1', correct: true }], tagsOf)

    expect(byTag.map((item) => item.tag).toSorted()).toEqual(['Cálculo', 'Limites'])
  })

  it('adds up across the questions of a tag', () => {
    const byTag = accuracyByTag(
      [
        { questionId: 'q1', correct: true },
        { questionId: 'q2', correct: false },
      ],
      tagsOf,
    )

    expect(byTag.find((item) => item.tag === 'Limites')?.percentage).toBe(50)
  })

  /** Worst first: the content that needs teaching again is the point. */
  it('orders from the weakest content to the strongest', () => {
    const byTag = accuracyByTag(
      [
        { questionId: 'q1', correct: true },
        { questionId: 'q3', correct: false },
      ],
      tagsOf,
    )

    expect(byTag[0]?.tag).toBe('Matrizes')
  })

  it('reports nothing for no results, rather than failing', () => {
    expect(accuracyByTag([], tagsOf)).toEqual([])
  })

  it('skips a question that carries no tag', () => {
    expect(accuracyByTag([{ questionId: 'untagged', correct: true }], tagsOf)).toEqual([])
  })
})
