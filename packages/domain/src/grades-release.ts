import type { Application, ApplicationProgress } from './domain';

export type ReleaseVerdict = { allowed: true } | { allowed: false; reason: string };

const ARCHIVED = 'Esta aplicação está arquivada. Restaure a aplicação antes de liberar as notas.';

const NOTHING_GENERATED = 'Gere a prova antes de liberar as notas.';

const ANSWER_KEY_PENDING = 'Publique o gabarito de todas as versões antes de liberar as notas.';

/**
 * Decides whether the grades of an application may be shown to the students
 * who scan their sheets (RF46): P14 explains the blocked button with the
 * reason, and the API asks again under the lock of the application, so both
 * refuse for the same reason.
 *
 * A grade never shows without the answer key, so every printed version needs
 * its key published, and an application with nothing printed has no key at
 * all. An archived application shows nothing new until it is restored (#46).
 * Taking the grades back is never refused, since it only hides them.
 */
export function canReleaseGrades(
  application: Pick<Application, 'status'>,
  progress: Pick<ApplicationProgress, 'versions' | 'publishedAnswerKeys'>,
): ReleaseVerdict {
  if (application.status === 'closed') return { allowed: false, reason: ARCHIVED };
  if (progress.versions === 0) return { allowed: false, reason: NOTHING_GENERATED };
  if (progress.publishedAnswerKeys < progress.versions) return { allowed: false, reason: ANSWER_KEY_PENDING };
  return { allowed: true };
}
