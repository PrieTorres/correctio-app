import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useServices } from '@/app/providers';
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
  list: (archived: boolean, search: string) => ['classes', 'list', { archived, search }] as const,
  detail: (id: string) => ['classes', 'detail', id] as const,
  students: (classId: string) => ['classes', classId, 'students'] as const,
};

export function useClassList(archived: boolean, search: string) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: classKeys.list(archived, search),
    queryFn: () => repositories.classes.list({ includeArchived: archived, search }),
  });
}

export function useClass(id: string | undefined) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: classKeys.detail(id ?? ''),
    queryFn: () => repositories.classes.getById(id!),
    enabled: id !== undefined,
  });
}

export function useStudents(classId: string | undefined) {
  const { repositories } = useServices();

  return useQuery({
    queryKey: classKeys.students(classId ?? ''),
    queryFn: () => repositories.students.listByClass(classId!),
    enabled: classId !== undefined,
  });
}

/** Shared invalidation so every mutation refreshes the same slice of cache. */
function useInvalidateClasses() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: classKeys.all });
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: StudentInput) => repositories.students.add(classId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: classKeys.students(classId) }),
  });
}

export type StudentAction = 'remove' | 'anonymize';

export function useStudentAction(classId: string) {
  const { repositories } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: StudentAction }) =>
      action === 'remove'
        ? repositories.students.remove(id)
        : repositories.students.anonymize(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: classKeys.students(classId) }),
  });
}
