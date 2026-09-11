import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useServices } from '@/app/services';
import { buildAnswerSheets, buildVersions } from '@/lib/applications';
import type { ApplicationInput } from '@/lib/schemas';

export const applicationKeys = {
  all: ['applications'] as const satisfies QueryKey,
  list: (archived: boolean, search: string) =>
    ['applications', 'list', { archived, search }] as const,
  detail: (id: string) => ['applications', 'detail', id] as const,
  printing: (id: string) => ['applications', 'printing', id] as const,
};

export function useApplicationList(archived: boolean, search: string) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: applicationKeys.list(archived, search),
    queryFn: () => repositories.applications.list({ search, includeArchived: archived }),
  });
}

export function useApplication(id: string | undefined) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: applicationKeys.detail(id ?? ''),
    queryFn: () => repositories.applications.getById(id ?? ''),
    enabled: id !== undefined,
  });
}

/** The versions and the sheets of one application, which are always read together. */
export function useApplicationPrinting(id: string | undefined) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: applicationKeys.printing(id ?? ''),
    queryFn: async () => {
      const [versions, sheets] = await Promise.all([
        repositories.printing.listVersions(id ?? ''),
        repositories.printing.listSheets(id ?? ''),
      ]);
      return { versions, sheets };
    },
    enabled: id !== undefined,
  });
}

/**
 * The corrections already made from this application printing.
 *
 * Read here for one question only: whether printing again would leave a
 * correction pointing at a layout that no longer exists.
 */
export function useCorrectionsOfApplication(id: string | undefined) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: [...applicationKeys.printing(id ?? ''), 'corrections'] as const,
    queryFn: async () => {
      const sheets = await repositories.printing.listSheets(id ?? '');
      return repositories.corrections.listByAnswerSheets(sheets.map((sheet) => sheet.id));
    },
    enabled: id !== undefined,
  });
}

function useInvalidateApplications() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: applicationKeys.all });
}

export function useSaveApplication() {
  const { repositories } = useServices();
  const invalidate = useInvalidateApplications();

  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ApplicationInput }) =>
      id === undefined
        ? repositories.applications.create(input)
        : repositories.applications.update(id, input),
    onSuccess: invalidate,
  });
}

export function useArchiveApplication() {
  const { repositories } = useServices();
  const invalidate = useInvalidateApplications();

  return useMutation({
    mutationFn: ({ id, archive }: { id: string; archive: boolean }) =>
      archive ? repositories.applications.archive(id) : repositories.applications.restore(id),
    onSuccess: invalidate,
  });
}

export interface GenerateOptions {
  versionCount: number;
  shuffleQuestions: boolean;
  shuffleAlternatives: boolean;
  withStudentIdentification: boolean;
}

/**
 * Produces the paper for an application: the versions and one sheet per student.
 *
 * Generating is where the exam stops being editable content and becomes a
 * printed artefact, so the exam is marked `ready` and the application
 * `generated`. Regenerating replaces both entirely — see the repository for why
 * keeping the old ones beside the new would make a sheet unreadable.
 */
export function useGenerateApplication() {
  const { repositories } = useServices();
  const invalidate = useInvalidateApplications();

  return useMutation({
    mutationFn: async ({ id, options }: { id: string; options: GenerateOptions }) => {
      const application = await repositories.applications.getById(id);
      if (application === null) throw new Error('Aplicação não encontrada');

      const exam = await repositories.exams.getById(application.examId);
      if (exam === null) throw new Error('Prova não encontrada');

      const [bank, students] = await Promise.all([
        repositories.questions.list({ pageSize: 1000 }),
        repositories.students.listByClass(application.classId),
      ]);

      const versions = buildVersions({
        applicationId: id,
        exam,
        bank: bank.items,
        ...options,
      });
      const sheets = buildAnswerSheets(id, versions, students);

      await repositories.printing.replaceForApplication(id, versions, sheets);
      await repositories.applications.markGenerated(id);
      await repositories.exams.markReady(exam.id);

      return { versions, sheets };
    },
    onSuccess: invalidate,
  });
}

export function usePublishAnswerKey() {
  const { repositories } = useServices();
  const invalidate = useInvalidateApplications();

  return useMutation({
    mutationFn: ({ versionId, published }: { versionId: string; published: boolean }) =>
      repositories.printing.publishAnswerKey(versionId, published),
    onSuccess: invalidate,
  });
}

export function useReleaseGrades() {
  const { repositories } = useServices();
  const invalidate = useInvalidateApplications();

  return useMutation({
    mutationFn: ({ id, released }: { id: string; released: boolean }) =>
      repositories.applications.setGradesReleased(id, released),
    onSuccess: invalidate,
  });
}
