import { useSearchParams } from 'react-router-dom';
import {
  APPLICATION_LIST_FILTER_PARAMS,
  readApplicationListFilters,
  type ApplicationListFilters,
} from '../list-filters';

/**
 * The class, exam and paper filters of P11, kept in the URL as the situation
 * of #158 is, so a filtered list survives a reload and can be sent as a link.
 * A filter that is cleared leaves the URL instead of staying in it empty, and
 * the situation (`status`) is left as it was.
 */
export function useApplicationListFilters(): {
  filters: ApplicationListFilters;
  setFilter: <Key extends keyof ApplicationListFilters>(key: Key, value: ApplicationListFilters[Key]) => void;
  clear: () => void;
} {
  const [params, setParams] = useSearchParams();

  const setFilter = <Key extends keyof ApplicationListFilters>(key: Key, value: ApplicationListFilters[Key]) => {
    const updated = new URLSearchParams(params);
    if (value === '') updated.delete(APPLICATION_LIST_FILTER_PARAMS[key]);
    else updated.set(APPLICATION_LIST_FILTER_PARAMS[key], value);
    setParams(updated, { replace: true });
  };

  const clear = () => {
    const updated = new URLSearchParams(params);
    for (const name of Object.values(APPLICATION_LIST_FILTER_PARAMS)) updated.delete(name);
    setParams(updated, { replace: true });
  };

  return { filters: readApplicationListFilters(params), setFilter, clear };
}
