import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/app/services';
import { reportKeys } from './report-keys';

/**
 * One row per application with a finished correction, the most recent first,
 * calculated on the server (#50). The filters of P19 narrow these rows in the
 * browser, so each row carries the class, subject, term and date they read.
 */
export function useConsolidatedReport() {
  const { repositories } = useServices();

  return useQuery({
    queryKey: reportKeys.consolidated,
    queryFn: () => repositories.reports.consolidated(),
  });
}
