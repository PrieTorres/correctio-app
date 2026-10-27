import { ROUTES } from '@/app/routes'

/**
 * Which slice of the applications list is on screen. Only `IN_PROGRESS`
 * carries a meaning beyond archived or not: the applications with a correction
 * still waiting for an open-ended score (RF48).
 */
export const APPLICATION_FILTER = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  IN_PROGRESS: 'correction-in-progress',
} as const);

export type ApplicationFilter = (typeof APPLICATION_FILTER)[keyof typeof APPLICATION_FILTER];

/**
 * The URL parameter that carries the filter, so the panel can link to the
 * filtered list and the choice survives a reload.
 *
 * Named here and nowhere else because the API's list filter (#46) must settle on
 * the same name; renaming it is a one-line change.
 */
export const APPLICATION_FILTER_PARAM = 'status';

/** Anything the URL carries that is not a known filter falls back to the default list. */
export function parseApplicationFilter(value: string | null): ApplicationFilter {
  const known = Object.values(APPLICATION_FILTER) as string[];
  return known.includes(value ?? '') ? (value as ApplicationFilter) : APPLICATION_FILTER.ACTIVE;
}

/** The list screen already filtered, for the links that lead to it. */
export function applicationListPath(filter: ApplicationFilter): string {
  return `${ROUTES.applications}?${APPLICATION_FILTER_PARAM}=${filter}`;
}
