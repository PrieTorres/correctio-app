import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/app/services';
import { reportKeys } from './report-keys';

/**
 * The report of one application (P18): the numbers, the questions and the
 * grades, calculated on the server (#50), so the screen only draws what comes.
 */
export function useApplicationReport(applicationId: string | undefined) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: reportKeys.application(applicationId ?? ''),
    queryFn: () => repositories.reports.application(applicationId ?? ''),
    enabled: applicationId !== undefined,
  });
}
