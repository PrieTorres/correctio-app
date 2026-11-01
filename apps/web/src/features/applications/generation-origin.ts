import { buildPath, ROUTES } from '@/app/routes';

/**
 * Where P13 was opened from, carried in the navigation state. "Voltar" and
 * "Cancelar" lead back there: a teacher who asked to regenerate from the detail
 * of an application expects to land on that detail, not on the whole list.
 */
export interface GenerationOrigin {
  returnTo: string;
}

/** The state a link to P13 carries when it starts on the detail (P14) of the application. */
export function fromDetailOf(applicationId: string): GenerationOrigin {
  return { returnTo: buildPath(ROUTES.applicationDetail, { id: applicationId }) };
}

/**
 * Where to go back to. The state comes from the browser history, so anything
 * that is not a path of the applications area falls back to the list.
 */
export function returnPathFrom(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('returnTo' in state)) return ROUTES.applications;
  const { returnTo } = state;
  return typeof returnTo === 'string' && returnTo.startsWith(`${ROUTES.applications}/`) ? returnTo : ROUTES.applications;
}
