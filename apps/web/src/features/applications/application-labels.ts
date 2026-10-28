import type { BadgeTone } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import type { ApplicationOverview, ApplicationStatus, ExamVersion } from '@/types/domain';

/** How each status reads on screen; `generated` is about the paper, which is what the teacher waits for. */
export const APPLICATION_STATUS_LABEL: Readonly<Record<ApplicationStatus, { label: string; tone: BadgeTone }>> = {
  draft: { label: 'A gerar', tone: 'neutral' },
  generated: { label: 'Gerada', tone: 'success' },
  closed: { label: 'Arquivada', tone: 'neutral' },
};

/** The names an application carries, with what a screen shows when one did not come. */
export function examTitleOf(application: Pick<ApplicationOverview, 'examTitle'>): string {
  return application.examTitle === '' ? 'Prova removida' : application.examTitle;
}

/**
 * Which application a screen is about, in one line: the class and the day.
 * The exam is the title of the screen, so this is what tells two sittings of
 * the same exam apart.
 */
export function sittingOf(application: Pick<ApplicationOverview, 'className' | 'date'>): string {
  const className = application.className === '' ? 'Turma removida' : application.className;
  return `${className} · ${formatDate(application.date)}`;
}

/** What a printed version did with the order of the exam, as P14 lists the versions. */
export function shuffleOf(version: Pick<ExamVersion, 'shuffleQuestions' | 'shuffleAlternatives'>): string {
  const questions = version.shuffleQuestions ? 'Questões embaralhadas' : 'Questões na ordem da prova';
  const alternatives = version.shuffleAlternatives ? 'alternativas embaralhadas' : 'alternativas na ordem';
  return `${questions} · ${alternatives}`;
}
