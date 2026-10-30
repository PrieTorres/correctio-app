import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useServices } from '@/app/services';
import type { ClassInput, StudentInput } from '@/lib/schemas';

/**
 * Cache keys in one place.
 *
 * Inline key arrays are how a cache starts lying: one call site invalidates
 * `['classes']` while another read `['Classes']`, and the screen silently
 * stops refreshing.
 */
export const classKeys = {
  all: ['classes'] as const satisfies QueryKey,
  lists: ['classes', 'list'] as const satisfies QueryKey,
  list: (archived: boolean, search: string, page = 1) => ['classes', 'list', { archived, search, page }] as const,
  detail: (id: string) => ['classes', 'detail', id] as const,
  students: (classId: string) => ['classes', classId, 'students'] as const,
};

/** One page of the list, as the API serves it; the screen pages beyond it. */
export const CLASS_PAGE_SIZE = 50;

/**
 * Search and paging run on the server, so each term and page is a request.
 * While the next one loads, the list keeps showing the last answer instead of
 * blinking into the loading state on every page turn.
 */
export function useClassList(archived: boolean, search: string, page = 1) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: classKeys.list(archived, search, page),
    queryFn: () => repositories.classes.list({ archived, search, page, pageSize: CLASS_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
}

export function useClass(id: string | undefined) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: classKeys.detail(id ?? ''),
    queryFn: () => repositories.classes.getById(id ?? ''),
    enabled: id !== undefined,
  });
}

export function useStudents(classId: string | undefined) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: classKeys.students(classId ?? ''),
    queryFn: () => repositories.students.listByClass(classId ?? ''),
    enabled: classId !== undefined,
  });
}

/** Shared invalidation so every mutation refreshes the same slice of cache. */
function useInvalidateClasses() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: classKeys.all });
}

/**
 * Every change to a class's students refreshes that class's students and the
 * lists of classes, whose cards count the students (#146); without the second,
 * P3 would show the old number until the cache expired.
 */
function useInvalidateStudents(classId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: classKeys.students(classId) }),
      queryClient.invalidateQueries({ queryKey: classKeys.lists }),
    ]);
}

export function useSaveClass() {
  const { repositories } = useServices();
  const invalidate = useInvalidateClasses();

  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ClassInput }) =>
      id === undefined
        ? repositories.classes.create(input)
        : repositories.classes.update(id, input),
    onSuccess: invalidate,
  });
}

/** Archive and restore are the same operation seen from either side. */
export function useArchiveClass() {
  const { repositories } = useServices();
  const invalidate = useInvalidateClasses();

  return useMutation({
    mutationFn: ({ id, archive }: { id: string; archive: boolean }) =>
      archive ? repositories.classes.archive(id) : repositories.classes.restore(id),
    onSuccess: invalidate,
  });
}

export function useAddStudent(classId: string) {
  const { repositories } = useServices();
  const invalidate = useInvalidateStudents(classId);

  return useMutation({
    mutationFn: (input: StudentInput) => repositories.students.add(classId, input),
    onSuccess: invalidate,
  });
}

/**
 * The pasted list, written in one request. The answer counts what came in and
 * what was skipped because the registration was already in the class, and the
 * import screen shows both.
 */
export function useImportStudents(classId: string) {
  const { repositories } = useServices();
  const invalidate = useInvalidateStudents(classId);

  return useMutation({
    mutationFn: (rows: StudentInput[]) => repositories.students.importMany(classId, rows),
    onSuccess: invalidate,
  });
}

export type StudentAction = 'remove' | 'anonymize';

export function useStudentAction(classId: string) {
  const { repositories } = useServices();
  const invalidate = useInvalidateStudents(classId);

  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: StudentAction }) =>
      action === 'remove'
        ? repositories.students.remove(classId, id)
        : repositories.students.anonymize(classId, id),
    onSuccess: invalidate,
  });
}
