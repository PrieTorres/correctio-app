import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/app/services';
import type { Application } from '@/types/domain';
import { gradableApplications } from '../grading-shortcut';

export const dashboardKeys = {
  summary: ['dashboard', 'summary'] as const,
};

export interface RecentActivity {
  id: string;
  title: string;
  detail: string;
  date: string;
}

/** What the panel shows at a glance. */
export interface DashboardSummary {
  classes: number;
  questions: number;
  exams: number;
  applications: number;
  recent: RecentActivity[];
  /** What "Corrigir folhas" offers: the applications with printed sheets, the most recent first. */
  gradable: RecentActivity[];
}

/** The panel before the summary arrives, so every part reads numbers instead of checking for each one. */
export const EMPTY_SUMMARY: DashboardSummary = {
  classes: 0,
  questions: 0,
  exams: 0,
  applications: 0,
  recent: [],
  gradable: [],
};

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
    queryFn: async (): Promise<DashboardSummary> => {
      const [classes, questions, exams, applications] = await Promise.all([
        repositories.classes.list({ pageSize: 1000 }),
        repositories.questions.list({ pageSize: 1000 }),
        repositories.exams.list({ pageSize: 1000 }),
        repositories.applications.list({ pageSize: 1000 }),
      ]);

      const examTitle = new Map(exams.items.map((exam) => [exam.id, exam.title]));
      const className = new Map(classes.items.map((item) => [item.id, item.name]));
      const toActivity = (application: Application): RecentActivity => ({
        id: application.id,
        title: examTitle.get(application.examId) ?? 'Prova removida',
        detail: className.get(application.classId) ?? 'Turma removida',
        date: application.date,
      });

      const recent = applications.items
        .toSorted((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5)
        .map(toActivity);

      return {
        classes: classes.total,
        questions: questions.total,
        exams: exams.total,
        applications: applications.total,
        recent,
        gradable: gradableApplications(applications.items).map(toActivity),
      };
    },
  });
}
