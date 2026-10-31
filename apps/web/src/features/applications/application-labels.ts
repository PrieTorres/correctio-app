import type { BadgeTone } from '@/components/ui';
import { correctionProgressOf } from '@/lib/applications';
import { formatDate } from '@/lib/utils';
import {
  CORRECTION_PROGRESS,
  type ApplicationOverview,
  type ApplicationProgress,
  type ApplicationStatus,
  type CorrectionProgress,
  type ExamVersion,
} from '@/types/domain';

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

/**
 * Whether the students can see the answer key, as P11 marks each item. Nothing
 * before the paper exists, and a partial publication says how far it went,
 * since the versions still hidden are the ones the teacher has to look for.
 */
export function answerKeyBadgeOf({
  versions,
  publishedAnswerKeys,
}: Pick<ApplicationProgress, 'versions' | 'publishedAnswerKeys'>): { label: string; tone: BadgeTone } | null {
  if (versions === 0) return null;
  if (publishedAnswerKeys === 0) return { label: 'Gabarito não publicado', tone: 'neutral' };
  if (publishedAnswerKeys < versions) {
    return { label: `Gabarito publicado em ${publishedAnswerKeys} de ${versions} versões`, tone: 'warning' };
  }
  return { label: 'Gabarito publicado', tone: 'success' };
}

const CORRECTION_PROGRESS_LABEL: Readonly<Record<CorrectionProgress, { label: string; tone: BadgeTone }>> = {
  [CORRECTION_PROGRESS.NOT_STARTED]: { label: 'Correção não iniciada', tone: 'neutral' },
  [CORRECTION_PROGRESS.IN_PROGRESS]: { label: 'Correção em andamento', tone: 'warning' },
  [CORRECTION_PROGRESS.DONE]: { label: 'Correção concluída', tone: 'success' },
};

/** Where the correction stands, in the three stages P11 filters by, for the lists that summarize an application. */
export function correctionBadgeOf(progress: Pick<ApplicationProgress, 'corrections' | 'correctedSheets'>): {
  label: string;
  tone: BadgeTone;
} {
  return CORRECTION_PROGRESS_LABEL[correctionProgressOf(progress)];
}

/** Why "Corrigir folhas" cannot start yet: before the paper exists there is no sheet to correct. */
export function correctionBlockerOf(application: Pick<ApplicationOverview, 'progress'>): string | undefined {
  return application.progress.sheets === 0 ? 'Gere o PDF antes de corrigir as folhas.' : undefined;
}

/** What a printed version did with the order of the exam, as P14 lists the versions. */
export function shuffleOf(version: Pick<ExamVersion, 'shuffleQuestions' | 'shuffleAlternatives'>): string {
  const questions = version.shuffleQuestions ? 'Questões embaralhadas' : 'Questões na ordem da prova';
  const alternatives = version.shuffleAlternatives ? 'alternativas embaralhadas' : 'alternativas na ordem';
  return `${questions} · ${alternatives}`;
}
