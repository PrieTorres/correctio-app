import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useServices } from '@/app/services';
import type { ApplicationInput, GenerationRequest } from '@/lib/schemas';
import { saveFile } from '@/lib/utils';

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
    queryFn: () => repositories.applications.list({ search, archived: archived }),
  });
}

/** One application with its overview: the exam, the class and how far it has gone. */
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

/**
 * Produces the paper for an application: the versions and one sheet per
 * student, and the PDF where there is a server to draw it.
 *
 * The screen sends only what P13 asks (RF22): how each version shuffles and
 * whether the sheets carry the name. Generating is where the exam stops being
 * editable content and becomes a printed artefact, so the exam turns `ready`
 * and the application `generated`, and regenerating replaces everything that
 * was printed before.
 */
export function useGenerateApplication() {
  const { repositories } = useServices();
  const invalidate = useInvalidateApplications();

  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: GenerationRequest }) =>
      repositories.applications.generate(id, request),
    onSuccess: invalidate,
  });
}

export function usePublishAnswerKey() {
  const { repositories } = useServices();
  const invalidate = useInvalidateApplications();

  return useMutation({
    mutationFn: ({
      applicationId,
      versionId,
      published,
    }: {
      applicationId: string;
      versionId: string;
      published: boolean;
    }) => repositories.printing.publishAnswerKey(applicationId, versionId, published),
    onSuccess: invalidate,
  });
}

/** "Publicar todos": every version at once, so a failure never leaves half of them published. */
export function usePublishAllAnswerKeys() {
  const { repositories } = useServices();
  const invalidate = useInvalidateApplications();

  return useMutation({
    mutationFn: (applicationId: string) => repositories.printing.publishAll(applicationId),
    onSuccess: invalidate,
  });
}

/**
 * Releasing writes the result straight into the cache before invalidating.
 *
 * Invalidating alone marks a screen that is not on display as stale without
 * refetching it, so coming back to the detail rendered the value from before
 * the change while the refetch was still in flight. A person clicking in that
 * window toggles what they are looking at, which is the opposite of what they
 * meant.
 */
export function useReleaseGrades() {
  const { repositories } = useServices();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateApplications();

  return useMutation({
    mutationFn: ({ id, released }: { id: string; released: boolean }) =>
      repositories.applications.setGradesReleased(id, released),
    onSuccess: (application) => {
      queryClient.setQueryData(applicationKeys.detail(application.id), application);
      return invalidate();
    },
  });
}

/** Saves the PDF of the application, which comes from the API with the teacher's token. */
export function useDownloadApplicationPdf() {
  const { repositories } = useServices();

  return useMutation({
    mutationFn: async (id: string) => {
      const { blob, filename } = await repositories.applications.downloadPdf(id);
      saveFile(blob, filename);
    },
  });
}
