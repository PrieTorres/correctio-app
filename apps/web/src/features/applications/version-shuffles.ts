import type { VersionShuffle } from '@/lib/schemas';

/** What the teacher switched on P13, by version index, over the preferences of the exam (RF17). */
export type ShuffleChanges = Readonly<Record<number, Partial<VersionShuffle>>>;

/**
 * How each version of P13 shuffles (RF22): the preferences of the exam, with
 * whatever the teacher switched on that version. Keeping only the changes,
 * rather than a copy of the preferences, means the exam can finish loading
 * after the screen opens and still fill in every version nobody touched.
 */
export function versionShufflesOf(count: number, preferences: VersionShuffle, changes: ShuffleChanges): VersionShuffle[] {
  return Array.from({ length: count }, (_, index) => ({ ...preferences, ...changes[index] }));
}

/** Records one switch of one version, leaving the other versions as they were. */
export function withChange(changes: ShuffleChanges, index: number, change: Partial<VersionShuffle>): ShuffleChanges {
  return { ...changes, [index]: { ...changes[index], ...change } };
}

/**
 * Drops what was switched on versions past `count`: a version removed and
 * added again starts from the preferences of the exam, as a new one does.
 */
export function withinCount(changes: ShuffleChanges, count: number): ShuffleChanges {
  return Object.fromEntries(Object.entries(changes).filter(([index]) => Number(index) < count));
}
