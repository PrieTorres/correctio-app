import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/app/services';

export interface ConsolidatedRow {
  applicationId: string;
  examTitle: string;
  className: string;
  date: string;
  scores: number[];
}

export const reportKeys = {
  consolidated: ['reports', 'consolidated'] as const,
};

/** One row per application that has at least one correction. */
export function useConsolidatedReport() {
  const { repositories } = useServices();

  return useQuery({
    queryKey: reportKeys.consolidated,
    queryFn: async (): Promise<ConsolidatedRow[]> => {
      /*
        Both sides of the archive, because an exam archived after being applied
        still names the row it produced. `archived` selects rather than adds,
        so reading both is two calls rather than one flag.
      */
      const [applications, exams, archivedExams, classes, archivedClasses] = await Promise.all([
        repositories.applications.list({ pageSize: 1000 }),
        repositories.exams.list({ pageSize: 1000 }),
        repositories.exams.list({ pageSize: 1000, archived: true }),
        repositories.classes.list({ pageSize: 1000 }),
        repositories.classes.list({ pageSize: 1000, archived: true }),
      ]);

      const examTitle = new Map(
        [...exams.items, ...archivedExams.items].map((exam) => [exam.id, exam.title]),
      );
      const className = new Map(
        [...classes.items, ...archivedClasses.items].map((item) => [item.id, item.name]),
      );

      const rows = await Promise.all(
        applications.items.map(async (application) => {
          const sheets = await repositories.printing.listSheets(application.id);
          const corrections = await repositories.corrections.listByAnswerSheets(
            sheets.map((sheet) => sheet.id),
          );

          return {
            applicationId: application.id,
            examTitle: examTitle.get(application.examId) ?? 'Prova removida',
            className: className.get(application.classId) ?? 'Turma removida',
            date: application.date,
            scores: corrections.map((correction) => correction.totalScore),
          };
        }),
      );

      return rows
        .filter((row) => row.scores.length > 0)
        .toSorted((a, b) => b.date.localeCompare(a.date));
    },
  });
}
