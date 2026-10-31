import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useServices } from '@/app/services';
import { applicationIdsInProgress, loadCorrectionsByApplication } from '@/lib/corrections';
import type { ApplicationListParams } from '@/lib/repositories/application-repository';
import { LARGEST_PAGE, readEveryPage } from '@/lib/repositories/read-every-page';
import type { ApplicationInput, GenerationRequest } from '@/lib/schemas';
import { saveFile } from '@/lib/utils';
import { filterOptionsOf } from '../list-filters';

export const applicationKeys = {
  all: ['applications'] as const satisfies QueryKey,
  list: (params: ApplicationListParams) => ['applications', 'list', params] as const,
  inProgress: ['applications', 'in-progress'] as const,
  detail: (id: string) => ['applications', 'detail', id] as const,
  printing: (id: string) => ['applications', 'printing', id] as const,
  choices: ['applications', 'choices'] as const,
  filterChoices: ['applications', 'filter-choices'] as const,
};

/**
 * One page of applications, filtered and sorted by the server. The page on
 * screen stays while the next one loads, so moving through the pages or
 * changing a filter does not blank the list.
 */
export function useApplicationList(params: ApplicationListParams = {}) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: applicationKeys.list(params),
    queryFn: () => repositories.applications.list(params),
    placeholderData: keepPreviousData,
  });
}

/**
 * Every class and exam of the teacher, archived ones included, for the filters
 * of P11. A teacher with more than a page of either still finds the one to
 * filter by.
 *
 * Read again on every visit (`staleTime: 0`): creating or archiving an exam or
 * a class invalidates only its own keys, and the list kept from the last visit
 * would leave out what was just created.
 */
export function useApplicationFilterChoices() {
  const { repositories } = useServices();

  return useQuery({
    queryKey: applicationKeys.filterChoices,
    staleTime: 0,
    queryFn: async () => {
      const [activeExams, archivedExams, activeClasses, archivedClasses] = await Promise.all([
        readEveryPage((page) => repositories.exams.list({ page, pageSize: LARGEST_PAGE })),
        readEveryPage((page) => repositories.exams.list({ page, pageSize: LARGEST_PAGE, archived: true })),
        readEveryPage((page) => repositories.classes.list({ page, pageSize: LARGEST_PAGE })),
        readEveryPage((page) => repositories.classes.list({ page, pageSize: LARGEST_PAGE, archived: true })),
      ]);
      return {
        exams: filterOptionsOf([...activeExams, ...archivedExams], (exam) => exam.title),
        classes: filterOptionsOf([...activeClasses, ...archivedClasses], (group) => group.name),
      };
    },
  });
}

/**
 * Every active exam and class, for the choices of P12. A teacher with more
 * than a page of either still finds the one to apply: the lists of P8 and P3
 * page, and a choice limited to their first page would hide the rest.
 *
 * Read again on every visit, for the reason given on the filters of P11: the
 * empty state sends the teacher to create an exam, and the exam must be there
 * when they come back.
 */
export function useSittingChoices() {
  const { repositories } = useServices();

  return useQuery({
    queryKey: applicationKeys.choices,
    staleTime: 0,
    queryFn: async () => {
      const [exams, classes] = await Promise.all([
        readEveryPage((page) => repositories.exams.list({ page, pageSize: LARGEST_PAGE })),
        readEveryPage((page) => repositories.classes.list({ page, pageSize: LARGEST_PAGE })),
      ]);
      return { exams, classes };
    },
  });
}

/**
 * The ids of the active applications with a correction still waiting for a
 * score. Read only while that filter is on screen, since it costs a read of
 * every sheet and correction.
 */
export function useApplicationIdsInProgress(enabled: boolean) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: applicationKeys.inProgress,
    queryFn: async () => {
      const { items } = await repositories.applications.list({ pageSize: 1000 });
      const byApplication = await loadCorrectionsByApplication(repositories, items);
      return [...applicationIdsInProgress(byApplication)];
    },
    enabled,
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

const NO_PAPER = { versions: [], sheets: [] } as const;

/**
 * The versions and sheets of an application for its detail, as empty lists
 * when they could not be read: a draft has none either, and the cards of P14
 * already say that nothing was generated, which beats an error over half of
 * the screen.
 */
export function usePrintedPaper(id: string) {
  const { data, isError } = useApplicationPrinting(id);
  return isError || data === undefined ? NO_PAPER : data;
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
