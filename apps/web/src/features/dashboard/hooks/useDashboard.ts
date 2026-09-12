import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/app/services';
import type { Application } from '@/types/domain';

export const dashboardKeys = {
  summary: ['dashboard', 'summary'] as const,
};

export interface RecentActivity {
  id: string;
  title: string;
  detail: string;
  date: string;
}

/**
 * The counts and the last few things that happened.
 *
 * Read in one query because the panel is a single glance: five separate
 * loading states on one screen is five chances to look broken.
 */
export function useDashboardSummary() {
  const { repositories } = useServices();

  return useQuery({
    queryKey: dashboardKeys.summary,
    queryFn: async () => {
      const [classes, questions, exams, applications] = await Promise.all([
        repositories.classes.list({ pageSize: 1000 }),
        repositories.questions.list({ pageSize: 1000 }),
        repositories.exams.list({ pageSize: 1000 }),
        repositories.applications.list({ pageSize: 1000 }),
      ]);

      const examTitle = new Map(exams.items.map((exam) => [exam.id, exam.title]));
      const className = new Map(classes.items.map((item) => [item.id, item.name]));

      const recent: RecentActivity[] = applications.items
        .toSorted((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5)
        .map((application: Application) => ({
          id: application.id,
          title: examTitle.get(application.examId) ?? 'Prova removida',
          detail: className.get(application.classId) ?? 'Turma removida',
          date: application.date,
        }));

      return {
        classes: classes.total,
        questions: questions.total,
        exams: exams.total,
        applications: applications.total,
        recent,
      };
    },
  });
}
