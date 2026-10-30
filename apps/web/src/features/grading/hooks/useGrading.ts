import { useMutation, useMutationState, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useServices } from '@/app/services';
import { dashboardKeys } from '@/features/dashboard/hooks/useDashboard';
import type { ReviewInput } from '@/lib/repositories/correction-repository';
import { sheetImageUploadSchema } from '@/lib/schemas';
import type { SheetImageUpload } from '@/lib/schemas';

export const gradingKeys = {
  all: ['grading'] as const satisfies QueryKey,
  ofApplication: (applicationId: string) => ['grading', 'application', applicationId] as const,
  uploads: (applicationId: string) => ['grading', 'uploads', applicationId] as const,
  readFailures: (applicationId: string) => ['grading', 'read-failures', applicationId] as const,
  photo: (applicationId: string, imageId: string) => ['grading', 'photo', applicationId, imageId] as const,
  unassigned: (applicationId: string) => ['grading', 'unassigned', applicationId] as const,
};

/**
 * How long a reading stays on the upload screen after its request ends. A
 * reading is not stored anywhere until the teacher confirms it (PM decision in
 * #47), so it lives in the cache of the mutation that sent the photo; an hour
 * covers grading a whole class, back and forth between P15 and P16.
 */
const READINGS_KEPT_MS = 60 * 60 * 1000;

/**
 * Everything the grading screens read about one application, in a single query.
 *
 * The sheets, their versions, the exam, its questions and whatever has already
 * been corrected are useless apart: a row in the list needs all of them to say
 * whether it is done, by how much, and for whom. The questions are read by the
 * ids the exam printed, deleted ones included, never as a page of the bank
 * (#48): a question deleted after the exam was applied is still on the paper.
 *
 * "For whom" includes the students removed from the class since: removing
 * keeps the record and the grades (RF09), so the sheets and the report go on
 * naming them (#161), and the assignment offers them too.
 */
export function useGradingOverview(applicationId: string | undefined) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: gradingKeys.ofApplication(applicationId ?? ''),
    queryFn: async () => {
      const application = await repositories.applications.getById(applicationId ?? '');
      if (application === null) return null;

      const [versions, sheets, exam, students, corrections] = await Promise.all([
        repositories.printing.listVersions(application.id),
        repositories.printing.listSheets(application.id),
        repositories.exams.getById(application.examId),
        repositories.students.listWithRemoved(application.classId),
        repositories.corrections.listByApplication(application.id),
      ]);
      const found = await Promise.all((exam?.questions ?? []).map((entry) => repositories.questions.getById(entry.questionId)));

      return { application, versions, sheets, exam, bank: found.filter((question) => question !== null), students, corrections };
    },
    enabled: applicationId !== undefined,
  });
}

/** Whatever a correction changes, the lists, the counts of the applications and the panel change with it. */
function useInvalidateGrading() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: gradingKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['applications'] }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.summary }),
    ]);
}

/**
 * Sends one photo and gets its reading back (#47). Each photo is a mutation of
 * its own, so the screen stays free while they run (RF41) and every row shows
 * its own state. The failures come back from the server's log, so the list of
 * failures is read again when a request ends.
 */
export function useUploadSheetPhoto(applicationId: string) {
  const { repositories } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: gradingKeys.uploads(applicationId),
    mutationFn: (photo: File) => repositories.sheetImages.upload(applicationId, photo),
    gcTime: READINGS_KEPT_MS,
    onSettled: () => queryClient.invalidateQueries({ queryKey: gradingKeys.readFailures(applicationId) }),
  });
}

/** One photo sent from this screen: still being read, read, or refused. */
export interface SheetUpload {
  key: number;
  fileName: string;
  state: 'pending' | 'success' | 'error' | 'idle';
  reading?: SheetImageUpload;
  error?: string;
}

/**
 * The photos sent for the application, from the mutations that sent them, the
 * most recent first. The cache holds what the mutation got, so the reading is
 * checked against its schema here instead of being taken on trust.
 */
export function useSheetUploads(applicationId: string): SheetUpload[] {
  const uploads = useMutationState({
    filters: { mutationKey: gradingKeys.uploads(applicationId) },
    select: ({ state }): SheetUpload => {
      const reading = sheetImageUploadSchema.safeParse(state.data);
      return {
        key: state.submittedAt,
        fileName: state.variables instanceof File ? state.variables.name : 'Foto',
        state: state.status,
        ...(reading.success && { reading: reading.data }),
        ...(state.error instanceof Error && { error: state.error.message }),
      };
    },
  });
  return uploads.toReversed();
}

/** The reading of one photo sent from this browser, which fills the review in (P16). */
export function useUploadedReading(applicationId: string, imageId: string | undefined): SheetImageUpload | undefined {
  const uploads = useSheetUploads(applicationId);
  return imageId === undefined ? undefined : uploads.find((upload) => upload.reading?.imageId === imageId)?.reading;
}

/** The photos whose reading failed, kept by the server, so a failure from yesterday is still on the list (P15). */
export function useReadFailures(applicationId: string) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: gradingKeys.readFailures(applicationId),
    queryFn: () => repositories.sheetImages.readFailures(applicationId),
  });
}

/** A photo does not change once sent, so it is read once and kept while the screen needs it. */
export function useSheetPhoto(applicationId: string, imageId: string | undefined) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: gradingKeys.photo(applicationId, imageId ?? ''),
    queryFn: () => repositories.sheetImages.photo(applicationId, imageId ?? ''),
    enabled: imageId !== undefined,
    staleTime: Infinity,
  });
}

/** The corrections still waiting for their student (P17), filtered by the server. */
export function useUnassignedCorrections(applicationId: string | undefined) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: gradingKeys.unassigned(applicationId ?? ''),
    queryFn: () => repositories.corrections.listByApplication(applicationId ?? '', { assigned: false }),
    enabled: applicationId !== undefined,
  });
}

export interface SaveReviewInput {
  applicationId: string;
  /** The correction being edited; left out the first time a sheet is reviewed. */
  correctionId?: string;
  review: ReviewInput;
}

/**
 * Stores what the teacher reviewed, finished or deliberately left open
 * (`finalize`). The grade comes back from whoever stores it, never from here.
 */
export function useSaveReview() {
  const { repositories } = useServices();
  const invalidate = useInvalidateGrading();

  return useMutation({
    mutationFn: ({ applicationId, correctionId, review }: SaveReviewInput) => {
      if (correctionId === undefined) return repositories.corrections.create(applicationId, review);
      const { answers, discursiveScores, finalize, notes, studentId } = review;
      return repositories.corrections.update(applicationId, correctionId, { answers, discursiveScores, finalize, notes, studentId });
    },
    onSuccess: invalidate,
  });
}

/** Names the student of a sheet printed without one (RF31); a conflict comes back when the student already has a sheet. */
export function useAssignStudent() {
  const { repositories } = useServices();
  const invalidate = useInvalidateGrading();

  return useMutation({
    mutationFn: ({ applicationId, correctionId, studentId }: { applicationId: string; correctionId: string; studentId: string }) =>
      repositories.corrections.update(applicationId, correctionId, { studentId }),
    onSuccess: invalidate,
  });
}
