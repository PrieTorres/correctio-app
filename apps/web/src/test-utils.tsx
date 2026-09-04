import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, type RenderHookResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createTeacherRepositories } from '@/lib/repositories';
import { createLocalAuthProvider } from '@/lib/auth';
import { AppServicesContext, type AppServices } from '@/app/services';

export const TEST_TEACHER_ID = 'teacher-under-test';

/**
 * Wraps a hook in the providers the application supplies at its root.
 *
 * Every feature needs this to test its data hooks, so it lives here rather
 * than being rebuilt per feature. Retries are off and the cache is fresh per
 * call, so one test can never see another test's data.
 */
export function renderHookWithProviders<TResult>(
  hook: () => TResult,
  services: Partial<AppServices> = {},
): RenderHookResult<TResult, void> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  const value: AppServices = {
    repositories: createTeacherRepositories(TEST_TEACHER_ID),
    auth: createLocalAuthProvider(),
    ...services,
  };

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AppServicesContext.Provider value={value}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </AppServicesContext.Provider>
    );
  }

  return renderHook(hook, { wrapper: Wrapper });
}
