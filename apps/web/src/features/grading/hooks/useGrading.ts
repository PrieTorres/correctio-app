import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useServices } from '@/app/services';
import {
  clampDiscursiveScore,
  discursiveQuestionIdsOf,
  gradeObjectives,
  readSheet,
  resolveCorrectionStatus,
  totalCorrectionScore,
  type MarkedAnswer,
} from '@/lib/grading';
import { createId } from '@/lib/utils';
import {
  CORRECTION_SOURCE,
  CORRECTION_STATUS,
  type Correction,
  type DiscursiveScore,
  type ObjectiveResult,
} from '@/types/domain';

export const gradingKeys = {
  all: ['grading'] as const satisfies QueryKey,
  ofApplication: (applicationId: string) => ['grading', 'application', applicationId] as const,
  sheet: (sheetId: string) => ['grading', 'sheet', sheetId] as const,
};

/**
 * Everything the grading screens read about one application, in a single query.
 *
 * The sheets, their versions, the exam, the bank and whatever has already been
 * corrected are useless apart: a row in the list needs all five to say whether
 * it is done, by how much, and for whom.
 */
export function useGradingOverview(applicationId: string | undefined) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: gradingKeys.ofApplication(applicationId ?? ''),
    queryFn: async () => {
      const application = await repositories.applications.getById(applicationId ?? '');
      if (application === null) return null;

      const [versions, sheets, exam, bank, students] = await Promise.all([
        repositories.printing.listVersions(application.id),
        repositories.printing.listSheets(application.id),
        repositories.exams.getById(application.examId),
        repositories.questions.list({ pageSize: 1000 }),
        repositories.students.listByClass(application.classId),
      ]);

      const corrections = await repositories.corrections.listByAnswerSheets(
        sheets.map((sheet) => sheet.id),
      );

      return { application, versions, sheets, exam, bank: bank.items, students, corrections };
    },
    enabled: applicationId !== undefined,
  });
}

function useInvalidateGrading() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: gradingKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['applications'] }),
    ]);
}

export interface ReadSheetsInput {
  applicationId: string;
  sheetIds: string[];
}

/**
 * Reads a batch of photographed sheets and stores what it understood.
 *
 * The reading is simulated — there is no server to do it, and a phone photo in
 * base64 exceeds the storage this phase has. What is real is everything after:
 * the grading, the status, and the fact that nothing is final until the teacher
 * confirms it on the review screen.
 */
export function useReadSheets() {
  const { repositories, auth } = useServices();
  const invalidate = useInvalidateGrading();

  return useMutation({
    mutationFn: async ({ applicationId, sheetIds }: ReadSheetsInput) => {
      const application = await repositories.applications.getById(applicationId);
      if (application === null) throw new Error('Aplicação não encontrada');

      const exam = await repositories.exams.getById(application.examId);
      if (exam === null) throw new Error('Prova não encontrada');

      const [versions, sheets, bank] = await Promise.all([
        repositories.printing.listVersions(applicationId),
        repositories.printing.listSheets(applicationId),
        repositories.questions.list({ pageSize: 1000 }),
      ]);

      /*
        Refusing loudly rather than recording an empty author: the stored schema
        requires one, so a correction saved without it is written and then
        dropped on every read afterwards — a grade that vanishes with nobody
        being told.
      */
      const teacher = auth.getCurrentUser();
      if (teacher === null) {
        throw new Error('Sessão encerrada. Entre novamente para registrar a correção.');
      }

      const versionById = new Map(versions.map((version) => [version.id, version]));
      const wanted = new Set(sheetIds);
      const discursiveIds = discursiveQuestionIdsOf(exam, bank.items);

      const saved: Correction[] = [];
      for (const sheet of sheets.filter((item) => wanted.has(item.id))) {
        const version = versionById.get(sheet.examVersionId);
        if (version === undefined) continue;

        const answers = readSheet(version, bank.items);
        const graded = gradeObjectives(exam, bank.items, answers);
        const existing = await repositories.corrections.findByAnswerSheet(sheet.id);

        saved.push(
          await repositories.corrections.save({
            id: existing?.id ?? createId(),
            examVersionId: version.id,
            answerSheetId: sheet.id,
            ...(sheet.studentId === undefined ? {} : { studentId: sheet.studentId }),
            status: resolveCorrectionStatus(discursiveIds, []),
            source: CORRECTION_SOURCE.IMAGE_UPLOAD,
            objectiveResults: graded.results,
            discursiveScores: [],
            totalScore: graded.score,
            confirmedAt: new Date().toISOString(),
            correctedBy: teacher.id,
            isAutomaticallyAssigned: sheet.studentId !== undefined,
          }),
        );
      }

      return saved;
    },
    onSuccess: invalidate,
  });
}

export interface ConfirmCorrectionInput {
  correction: Correction;
  answers: MarkedAnswer[];
  discursiveScores: DiscursiveScore[];
  objectiveResults: ObjectiveResult[];
  discursiveQuestionIds: string[];
  /**
   * False keeps the correction open on purpose, for a teacher who stops in the
   * middle. What was reviewed is stored either way — leaving the screen is
   * what used to throw it away.
   */
  finalize: boolean;
}

/** Stores what the teacher reviewed, finished or deliberately left open. */
export function useConfirmCorrection() {
  const { repositories } = useServices();
  const invalidate = useInvalidateGrading();

  return useMutation({
    mutationFn: ({
      correction,
      discursiveScores,
      objectiveResults,
      discursiveQuestionIds,
      finalize,
    }: ConfirmCorrectionInput) =>
      repositories.corrections.save({
        ...correction,
        objectiveResults,
        discursiveScores,
        status: finalize
          ? resolveCorrectionStatus(discursiveQuestionIds, discursiveScores)
          : CORRECTION_STATUS.IN_PROGRESS,
        totalScore: totalCorrectionScore(objectiveResults, discursiveScores),
        confirmedAt: new Date().toISOString(),
      }),
    onSuccess: invalidate,
  });
}

export function useAssignStudent() {
  const { repositories } = useServices();
  const invalidate = useInvalidateGrading();

  return useMutation({
    mutationFn: ({ correctionId, studentId }: { correctionId: string; studentId: string }) =>
      repositories.corrections.assignStudent(correctionId, studentId),
    onSuccess: invalidate,
  });
}

export { clampDiscursiveScore };
