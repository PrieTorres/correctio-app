import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useServices } from '@/app/services';
import type { QuestionInput } from '@/lib/schemas';
import type { QuestionType } from '@/types/domain';
import type { QuestionSort } from '@/lib/repositories/question-repository';

export type { QuestionSort };

export interface QuestionFilters {
  search: string;
  type: QuestionType | 'all';
  tags: string[];
  deleted: boolean;
  /** Untagged questions are the ones that never reach an automatic draw. */
  onlyUntagged?: boolean;
  sort?: QuestionSort;
  /** 1-based page. Pagination runs on the server, so it is part of the key. */
  page?: number;
}

export const questionKeys = {
  all: ['questions'] as const satisfies QueryKey,
  list: (filters: QuestionFilters) => ['questions', 'list', filters] as const,
  detail: (id: string) => ['questions', 'detail', id] as const,
};

/** One page of the bank, as the screen asks the server for it. */
export const QUESTION_PAGE_SIZE = 50;

/**
 * Search, filters and paging run on the server, so each combination is a
 * request. While the next one loads, the list keeps the last answer instead of
 * blinking into the loading state on every page turn.
 */
export function useQuestionList(filters: QuestionFilters) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: questionKeys.list(filters),
    queryFn: () =>
      repositories.questions.list({
        search: filters.search,
        archived: filters.deleted,
        type: filters.type === 'all' ? undefined : filters.type,
        tags: filters.tags.length > 0 ? filters.tags : undefined,
        onlyUntagged: filters.onlyUntagged,
        sort: filters.sort,
        page: filters.page,
        pageSize: QUESTION_PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });
}

/**
 * The page size that reads the whole bank in one request: the API's ceiling
 * (`MAX_PAGE_SIZE`), the same the other whole-list reads ask for.
 */
export const WHOLE_BANK_PAGE_SIZE = 1000;

/**
 * Every active question of the teacher, for the exam screens. An exam finds
 * its questions by id and the automatic draw picks from all of them, so a
 * question past the first page of the bank must not read as removed.
 */
export function useQuestionBank() {
  const { repositories } = useServices();

  return useQuery({
    queryKey: [...questionKeys.all, 'bank'] as const,
    queryFn: () => repositories.questions.list({ archived: false, pageSize: WHOLE_BANK_PAGE_SIZE }),
  });
}

export function useQuestion(id: string | undefined) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: questionKeys.detail(id ?? ''),
    queryFn: () => repositories.questions.getById(id ?? ''),
    enabled: id !== undefined,
  });
}

/** Every tag already in use, for the filter and for suggesting while typing. */
export function useQuestionTags() {
  const { repositories } = useServices();

  return useQuery({
    queryKey: [...questionKeys.all, 'tags'] as const,
    queryFn: () => repositories.questions.tags(),
  });
}

function useInvalidateQuestions() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: questionKeys.all });
}

export function useSaveQuestion() {
  const { repositories } = useServices();
  const invalidate = useInvalidateQuestions();

  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: QuestionInput }) =>
      id === undefined
        ? repositories.questions.create(input)
        : repositories.questions.update(id, input),
    onSuccess: invalidate,
  });
}

export function useDuplicateQuestion() {
  const { repositories } = useServices();
  const invalidate = useInvalidateQuestions();

  return useMutation({
    mutationFn: async (id: string) => {
      const original = await repositories.questions.getById(id);
      if (original === null) throw new Error('Questão não encontrada');

      return repositories.questions.create({
        type: original.type,
        statement: `${original.statement} (cópia)`,
        tags: original.tags,
        alternatives: original.alternatives,
        correctAlternativeId: original.correctAlternativeId,
        maxScore: original.maxScore,
        allowShuffleAlternatives: original.allowShuffleAlternatives,
      });
    },
    onSuccess: invalidate,
  });
}

export function useDeleteQuestion() {
  const { repositories } = useServices();
  const invalidate = useInvalidateQuestions();

  return useMutation({
    mutationFn: ({ id, deleted }: { id: string; deleted: boolean }) =>
      deleted ? repositories.questions.archive(id) : repositories.questions.restore(id),
    onSuccess: invalidate,
  });
}