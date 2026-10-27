import { APPLICATION_FILTER, type ApplicationFilter } from '../application-filter';
import { useApplicationIdsInProgress, useApplicationList } from './useApplications';

/**
 * The applications the list shows for a filter.
 *
 * "Correction in progress" is a slice of the active applications, so it reads
 * the active list and keeps the ones the corrections point at. The pending
 * flags are read from the second query only while that filter is on, because a
 * disabled query reports itself as pending and would hold every other filter on
 * the loading screen.
 */
export function useVisibleApplications(filter: ApplicationFilter, search: string) {
  const inProgress = filter === APPLICATION_FILTER.IN_PROGRESS;
  const list = useApplicationList(filter === APPLICATION_FILTER.ARCHIVED, search);
  const ids = useApplicationIdsInProgress(inProgress);

  const items = list.data?.items ?? [];
  const waiting = new Set(ids.data ?? []);

  return {
    applications: inProgress ? items.filter((application) => waiting.has(application.id)) : items,
    isPending: list.isPending || (inProgress && ids.isPending),
    isError: list.isError || (inProgress && ids.isError),
  };
}
