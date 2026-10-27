import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useServices } from '@/app/services';
import type { QuestionInput } from '@/lib/schemas';
import type { Question, QuestionType } from '@/types/domain';
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

/** The questions of an exam by id, and whether any is still on its way. */
export interface QuestionLookup {
  byId: ReadonlyMap<string, Question>;
  isPending: boolean;
}

/** Declared once, outside the hook, so the lookup is rebuilt only when an answer changes. */
function toLookup(results: UseQueryResult<Question | null>[]): QuestionLookup {
  const byId = new Map<string, Question>();
  for (const { data } of results) if (data) byId.set(data.id, data);
  return { byId, isPending: results.some((result) => result.isPending) };
}

/**
 * The questions of an exam, looked up one by one, deleted ones included: an
 * exam keeps a question the bank deleted later (RF13), wherever it would fall
 * in the paged list. An exam has 20 questions at most (RF15), so this never
 * fans out far, and a question picked or drawn on screen is already in the
 * cache under the same key (`useRememberQuestions`).
 */
export function useQuestionsByIds(ids: readonly string[]): QuestionLookup {
  const { repositories } = useServices();

  return useQueries({
    queries: ids.map((id) => ({
      queryKey: questionKeys.detail(id),
      queryFn: () => repositories.questions.getById(id),
    })),
    combine: toLookup,
  });
}

/**
 * Keeps questions the screen already holds, from the picker or the draw, in
 * the cache of `useQuestionsByIds`, so a question just added shows its
 * statement at once instead of waiting for a request that would answer the
 * same thing.
 */
export function useRememberQuestions() {
  const queryClient = useQueryClient();
  return (questions: readonly Question[]) => {
    for (const question of questions) queryClient.setQueryData(questionKeys.detail(question.id), question);
  };
}

/**
 * How many active questions carry every tag asked, counted by the server: the
 * `total` of a one-item page, so the automatic exam shows what is available
 * without loading the bank.
 */
export function useQuestionCount(tags: readonly string[]) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: [...questionKeys.all, 'count', [...tags].sort((a, b) => a.localeCompare(b, 'pt-BR'))] as const,
    queryFn: async () => {
      const page = await repositories.questions.list({ archived: false, tags: tags.length > 0 ? [...tags] : undefined, pageSize: 1 });
      return page.total;
    },
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