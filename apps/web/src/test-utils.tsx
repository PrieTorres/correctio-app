import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, type RenderHookResult, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentType, ReactNode } from 'react';
import { createTeacherRepositories } from '@/lib/repositories';
import { createLocalAuthProvider } from '@/lib/auth';
import { AppServicesContext, type AppServices } from '@/app/services';

export const TEST_TEACHER_ID = 'teacher-under-test';

/**
 * Builds the provider stack the application supplies at its root.
 *
 * Retries are off and the cache is fresh per call, so one test can never see
 * another test's data.
 */
function buildWrapper(services: Partial<AppServices>): ComponentType<{ children: ReactNode }> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  const value: AppServices = {
    repositories: createTeacherRepositories(TEST_TEACHER_ID),
    auth: createLocalAuthProvider(),
    ...services,
  };

  return function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
    return (
      <AppServicesContext.Provider value={value}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </AppServicesContext.Provider>
    );
  };
}

/** Renders a hook inside the application providers. */
export function renderHookWithProviders<TResult>(
  hook: () => TResult,
  services: Partial<AppServices> = {},
): RenderHookResult<TResult, void> {
  return renderHook(hook, { wrapper: buildWrapper(services) });
}

/**
 * Renders a screen inside the application providers and a memory router.
 *
 * Screens are covered by Cypress as a rule. This exists for the handful of
 * form invariants worth catching before a browser is available — a wrong
 * binding between a control and the schema it feeds, for instance.
 */
export function renderWithProviders(
  ui: ReactNode,
  services: Partial<AppServices> = {},
): RenderResult {
  const Wrapper = buildWrapper(services);
  return render(
    <Wrapper>
      <MemoryRouter>{ui}</MemoryRouter>
    </Wrapper>,
  );
}
