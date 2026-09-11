import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useServices } from '@/app/services';
import type { ExamInput } from '@/lib/schemas';

export const examKeys = {
  all: ['exams'] as const satisfies QueryKey,
  list: (archived: boolean, search: string) => ['exams', 'list', { archived, search }] as const,
  detail: (id: string) => ['exams', 'detail', id] as const,
};

export function useExamList(archived: boolean, search: string) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: examKeys.list(archived, search),
    queryFn: () => repositories.exams.list({ search, includeArchived: archived }),
  });
}

export function useExam(id: string | undefined) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: examKeys.detail(id ?? ''),
    queryFn: () => repositories.exams.getById(id ?? ''),
    enabled: id !== undefined,
  });
}

function useInvalidateExams() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: examKeys.all });
}

export function useSaveExam() {
  const { repositories } = useServices();
  const invalidate = useInvalidateExams();

  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ExamInput }) =>
      id === undefined ? repositories.exams.create(input) : repositories.exams.update(id, input),
    onSuccess: invalidate,
  });
}

/** Archiving and restoring are the same operation seen from either side. */
export function useArchiveExam() {
  const { repositories } = useServices();
  const invalidate = useInvalidateExams();

  return useMutation({
    mutationFn: ({ id, archive }: { id: string; archive: boolean }) =>
      archive ? repositories.exams.archive(id) : repositories.exams.restore(id),
    onSuccess: invalidate,
  });
}

/**
 * Copies an exam so a new term can start from the last one.
 *
 * The copy is created through the same input the form submits, which is what
 * makes it come out as a draft with an identity of its own: duplicating must
 * never touch the exam being copied, including its status.
 */
export function useDuplicateExam() {
  const { repositories } = useServices();
  const invalidate = useInvalidateExams();

  return useMutation({
    mutationFn: async (id: string) => {
      const original = await repositories.exams.getById(id);
      if (original === null) throw new Error('Prova não encontrada');

      return repositories.exams.create({
        title: `${original.title} (cópia)`,
        description: original.description,
        questions: original.questions,
        defaultShuffleQuestions: original.defaultShuffleQuestions,
        defaultShuffleAlternatives: original.defaultShuffleAlternatives,
      });
    },
    onSuccess: invalidate,
  });
}
