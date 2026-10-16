import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/app/services';
import { useCurrentUser } from '@/features/auth';
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
 * failure to retry. Nothing is cached: a grade released a minute ago must show
 * on the next scan, and the page is public, so nothing of it stays behind.
 *
 * The API answers the same lookup at `GET /public/sheets/:code` (#49), with the
 * same rule from `@correctio/domain`. This page switches to it once the sheets
 * are written to the database (#46); until then they live in this browser,
 * which belongs to whoever is signed in here, so it waits for the session to be
 * restored: asked earlier, it searched nobody's data and called a real code
 * invalid.
 */
export function usePublicLookup(code: string | undefined) {
  const { repositories } = useServices();
  const session = useCurrentUser();

  return useQuery<PublicLookup>({
    queryKey: publicLookupKeys.byCode(code ?? ''),
    enabled: code !== undefined && !session.isPending,
    retry: false,
    staleTime: 0,
    gcTime: 0,
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
