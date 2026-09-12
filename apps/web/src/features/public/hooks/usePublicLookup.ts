import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/app/services';
import { resolvePublicLookup } from '@/lib/public-lookup';
import type { PublicLookup } from '@/types/domain';

export const publicLookupKeys = {
  byCode: (code: string) => ['public-lookup', code] as const,
};

/**
 * Resolves a printed code into the least the rule allows.
 *
 * The repositories are teacher-scoped everywhere else; here the reader has no
 * account at all, so the lookup walks from the sheet outwards and stops at the
 * first thing missing. Retries are off: an unknown code is an answer, not a
 * failure to retry.
 */
export function usePublicLookup(code: string | undefined) {
  const { repositories } = useServices();

  return useQuery<PublicLookup>({
    queryKey: publicLookupKeys.byCode(code ?? ''),
    enabled: code !== undefined,
    retry: false,
    queryFn: async () => {
      const sheet = await repositories.printing.findSheetByCode(code ?? '');
      if (sheet === null) return { status: 'INVALID_CODE' };

      const [versions, correction] = await Promise.all([
        repositories.printing.listVersions(sheet.applicationId),
        repositories.corrections.findByAnswerSheet(sheet.id),
      ]);
      const version = versions.find((item) => item.id === sheet.examVersionId) ?? null;

      const application = await repositories.applications.getById(sheet.applicationId);
      if (application === null) return { status: 'INVALID_CODE' };

      const [exam, group, students, bank] = await Promise.all([
        repositories.exams.getById(application.examId),
        repositories.classes.getById(application.classId),
        repositories.students.listByClass(application.classId),
        repositories.questions.list({ pageSize: 1000 }),
      ]);

      const studentId = sheet.studentId ?? correction?.studentId;
      const student = students.find((item) => item.id === studentId) ?? null;

      return resolvePublicLookup({
        sheet,
        version,
        application,
        exam,
        group,
        student,
        correction,
        bank: bank.items,
      });
    },
  });
}
