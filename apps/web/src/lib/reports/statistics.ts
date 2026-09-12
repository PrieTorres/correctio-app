export interface Distribution {
  /** Inclusive lower bound of the band. */
  from: number
  /** Exclusive upper bound, except for the last band. */
  to: number
  count: number
}

export interface ScoreSummary {
  count: number
  mean: number
  median: number
  standardDeviation: number
  lowest: number
  highest: number
}

/**
 * Summarises a set of grades.
 *
 * An empty list is the case that breaks this in production, and it is not an
 * error: a report opened before anyone has been corrected is a normal screen.
 * Everything comes back as zero rather than as `NaN`, because `NaN` reaches the
 * interface and reads as a bug to whoever sees it.
 *
 * The deviation is the population one, not the sample: these are all the grades
 * of the class, not a sample drawn from a larger group.
 */
export function summarise(scores: readonly number[]): ScoreSummary {
  if (scores.length === 0) {
    return { count: 0, mean: 0, median: 0, standardDeviation: 0, lowest: 0, highest: 0 }
  }

  const sorted = [...scores].toSorted((a, b) => a - b)
  const mean = sorted.reduce((sum, score) => sum + score, 0) / sorted.length
  const variance = sorted.reduce((sum, score) => sum + (score - mean) ** 2, 0) / sorted.length

  return {
    count: sorted.length,
    mean: round(mean),
    median: round(medianOf(sorted)),
    standardDeviation: round(Math.sqrt(variance)),
    lowest: sorted[0] ?? 0,
    highest: sorted[sorted.length - 1] ?? 0,
  }
}

/** An even count has no middle value, so the two around it are averaged. */
function medianOf(sorted: readonly number[]): number {
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

/**
 * Counts the grades falling in each band of a histogram.
 *
 * The top band includes its upper bound, so the highest possible grade is
 * counted rather than falling off the end of the chart.
 */
export function distribute(
  scores: readonly number[],
  maximum: number,
  bands = 5,
): Distribution[] {
  if (bands <= 0 || maximum <= 0) return []

  const width = maximum / bands

  return Array.from({ length: bands }, (_, index) => {
    const from = round(index * width)
    const to = round((index + 1) * width)
    const isLast = index === bands - 1

    return {
      from,
      to,
      count: scores.filter((score) => score >= from && (isLast ? score <= to : score < to)).length,
    }
  })
}

export interface QuestionAccuracy {
  questionId: string
  answered: number
  correct: number
  /** Between 0 and 100, rounded to one decimal. */
  percentage: number
  mostMarkedAlternativeId?: string
}

/**
 * How a class did on one question, and what most of them marked.
 *
 * The most-marked alternative is what turns a percentage into something to act
 * on: when a wrong alternative wins, it usually names the misconception rather
 * than the difficulty.
 */
export function accuracyOf(
  questionId: string,
  results: readonly { questionId: string; correct: boolean; selectedAlternativeId?: string }[],
): QuestionAccuracy {
  const forQuestion = results.filter((result) => result.questionId === questionId)
  const correct = forQuestion.filter((result) => result.correct).length

  const tally = new Map<string, number>()
  for (const result of forQuestion) {
    if (result.selectedAlternativeId === undefined) continue
    tally.set(result.selectedAlternativeId, (tally.get(result.selectedAlternativeId) ?? 0) + 1)
  }

  const mostMarked = [...tally.entries()].toSorted((a, b) => b[1] - a[1])[0]?.[0]

  return {
    questionId,
    answered: forQuestion.length,
    correct,
    percentage: forQuestion.length === 0 ? 0 : round1((correct / forQuestion.length) * 100),
    ...(mostMarked === undefined ? {} : { mostMarkedAlternativeId: mostMarked }),
  }
}

export interface TagAccuracy {
  tag: string
  answered: number
  correct: number
  percentage: number
}

/**
 * Accuracy grouped by content tag, which is what the client asked for.
 *
 * A percentage per question says which question was hard; a percentage per tag
 * says which content was not learned, and that is the one a teacher can teach
 * again.
 */
export function accuracyByTag(
  results: readonly { questionId: string; correct: boolean }[],
  tagsOf: (questionId: string) => readonly string[],
): TagAccuracy[] {
  const tally = new Map<string, { answered: number; correct: number }>()

  for (const result of results) {
    for (const tag of tagsOf(result.questionId)) {
      const current = tally.get(tag) ?? { answered: 0, correct: 0 }
      tally.set(tag, {
        answered: current.answered + 1,
        correct: current.correct + (result.correct ? 1 : 0),
      })
    }
  }

  return [...tally.entries()]
    .map(([tag, counts]) => ({
      tag,
      answered: counts.answered,
      correct: counts.correct,
      percentage: counts.answered === 0 ? 0 : round1((counts.correct / counts.answered) * 100),
    }))
    .toSorted((a, b) => a.percentage - b.percentage)
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}
