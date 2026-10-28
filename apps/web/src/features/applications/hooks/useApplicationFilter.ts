import { useSearchParams } from 'react-router-dom';
import {
  APPLICATION_FILTER_PARAM,
  parseApplicationFilter,
  type ApplicationFilter,
} from '../application-filter';

/**
 * The list filter, kept in the URL rather than in state: that is what lets the
 * panel's card open the list already filtered and what keeps the choice after a
 * reload. The default is left out of the URL so an unfiltered list keeps a
 * clean address.
 */
export function useApplicationFilter(): [ApplicationFilter, (filter: ApplicationFilter) => void] {
  const [params, setParams] = useSearchParams();
  const filter = parseApplicationFilter(params.get(APPLICATION_FILTER_PARAM));

  const setFilter = (next: ApplicationFilter) => {
    const updated = new URLSearchParams(params);
    updated.set(APPLICATION_FILTER_PARAM, next);
    setParams(updated, { replace: true });
  };

  return [filter, setFilter];
}
