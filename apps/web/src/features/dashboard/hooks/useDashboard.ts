import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/app/services';
import type { DashboardSummary } from '@/lib/reports';

export const dashboardKeys = {
  summary: ['dashboard', 'summary'] as const,
};

/** The panel before the summary arrives, so every part reads numbers instead of checking for each one. */
export const EMPTY_SUMMARY: DashboardSummary = {
  classes: 0,
  questions: 0,
  exams: 0,
  applications: 0,
  pendingCorrections: 0,
  recent: [],
  gradable: [],
};

/**
 * The counts and the last few things that happened.
 *
 * One request, counted and sorted on the server (#50): the panel is a single
 * glance, and five separate loading states on one screen is five chances to
 * look broken.
 */
export function useDashboardSummary() {
  const { repositories } = useServices();

  return useQuery({
    queryKey: dashboardKeys.summary,
    queryFn: () => repositories.reports.dashboard(),
  });
}
