/**
 * The keys of the reports. Under one root, so whatever changes a grade, a
 * class or an exam marks every report stale at once (`createAppQueryClient`).
 */
export const reportKeys = {
  all: ['reports'] as const,
  consolidated: ['reports', 'consolidated'] as const,
  application: (applicationId: string) => ['reports', 'application', applicationId] as const,
};
