import type { Page } from '@/lib/repositories';
import type { ApplicationOverview } from '@/types/domain';
import { APPLICATION_FILTER } from '../application-filter';
import { listParamsOf, pageOf, type ApplicationListQuery } from '../list-filters';
import { useApplicationIdsInProgress, useApplicationList } from './useApplications';

/**
 * The applications the list shows for a filter, and how many there are in
 * all, for the pagination.
 *
 * "Correction in progress" is a slice of the active applications, so it reads
 * every active match and keeps the ones the corrections point at, paging what
 * is left here. The pending flags are read from the second query only while
 * that filter is on, because a disabled query reports itself as pending and
 * would hold every other filter on the loading screen.
 *
 * The corrections still live in this browser. Issue #48 moves them to the API,
 * and then this view asks the server for `correction: 'IN_PROGRESS'` instead,
 * as the panel card should, and the read of the corrections here goes away.
 */
export function useVisibleApplications(query: ApplicationListQuery) {
  const inProgress = query.filter === APPLICATION_FILTER.IN_PROGRESS;
  const list = useApplicationList(listParamsOf(query));
  const ids = useApplicationIdsInProgress(inProgress);

  return {
    ...visibleOf({ answered: list.data, waitingIds: inProgress ? (ids.data ?? []) : undefined, page: query.page }),
    isPending: list.isPending || (inProgress && ids.isPending),
    isError: list.isError || (inProgress && ids.isError),
  };
}

/**
 * What the list shows of the page the API answered: that page as it came, or,
 * given the ids still waiting for a score, the applications among them, paged
 * here since the API answered every match at once.
 */
function visibleOf({
  answered,
  waitingIds,
  page,
}: {
  answered: Page<ApplicationOverview> | undefined;
  waitingIds: readonly string[] | undefined;
  page: number;
}): { applications: ApplicationOverview[]; total: number } {
  const items = answered?.items ?? [];
  if (waitingIds === undefined) return { applications: items, total: answered?.total ?? 0 };

  const waiting = new Set(waitingIds);
  const kept = items.filter((application) => waiting.has(application.id));
  return { applications: pageOf(kept, page), total: kept.length };
}
