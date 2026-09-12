import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useServices } from '@/app/services';
import type { QuestionInput } from '@/lib/schemas';
import type { Question, QuestionType } from '@/types/domain';

export type QuestionSort = 'newest' | 'statement';

export interface QuestionFilters {
  search: string;
  type: QuestionType | 'all';
  tags: string[];
  deleted: boolean;
  /** Untagged questions are the ones that never reach an automatic draw. */
  onlyUntagged?: boolean;
  sort?: QuestionSort;
}

export const questionKeys = {
  all: ['questions'] as const satisfies QueryKey,
  list: (filters: QuestionFilters) => ['questions', 'list', filters] as const,
  detail: (id: string) => ['questions', 'detail', id] as const,
};

/**
 * Type and tag are narrowed here rather than in the repository.
 *
 * The repository mirrors the future HTTP contract, which pages and searches by
 * text. Filtering the page it returns keeps that contract honest, and the data
 * volume of a question bank makes the difference immaterial.
 */
function matchesFilters(question: Question, filters: QuestionFilters): boolean {
  const matchesType = filters.type === 'all' || question.type === filters.type;
  const matchesTags =
    filters.tags.length === 0 || filters.tags.every((tag) => question.tags.includes(tag));
  const matchesUntagged = filters.onlyUntagged !== true || question.tags.length === 0;
  return matchesType && matchesTags && matchesUntagged;
}

export function useQuestionList(filters: QuestionFilters) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: questionKeys.list(filters),
    queryFn: async () => {
      const page = await repositories.questions.list({
        search: filters.search,
        archived: filters.deleted,
      });
      const items = page.items.filter((item) => matchesFilters(item, filters));

      /*
        The repository already answers newest first, which is what someone who
        just wrote a question needs. Sorting by statement is the other way to
        look at a bank — reading it — and belongs to whoever asked for it.
      */
      return {
        ...page,
        items:
          filters.sort === 'statement'
            ? items.toSorted((a, b) => a.statement.localeCompare(b.statement, 'pt-BR'))
            : items,
      };
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
    queryFn: async () => {
      const page = await repositories.questions.list({ pageSize: 1000 });
      const tags = new Set(page.items.flatMap((item) => item.tags));
      return [...tags].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    },
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

/** Soft delete and restore are the same operation seen from either side. */
export function useDeleteQuestion() {
  const { repositories } = useServices();
  const invalidate = useInvalidateQuestions();

  return useMutation({
    mutationFn: ({ id, deleted }: { id: string; deleted: boolean }) =>
      deleted ? repositories.questions.archive(id) : repositories.questions.restore(id),
    onSuccess: invalidate,
  });
}
