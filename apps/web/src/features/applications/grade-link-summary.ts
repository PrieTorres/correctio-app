import type { GradeLinkSummary } from '@/types/domain';

const SKIPPED_LABELS = [
  ['noEmail', 'sem e-mail'],
  ['anonymized', 'anonimizados'],
  ['removed', 'fora da turma'],
  ['noSheet', 'sem folha'],
] as const satisfies readonly (readonly [keyof GradeLinkSummary['skipped'], string])[];

/**
 * What the teacher reads after asking for the links: how many e-mails went out,
 * how many students were left out and why (only the reasons that happened), and
 * how many could not be reached, which a second request would send again to
 * everyone who already got theirs.
 */
export function describeGradeLinks({ sent, failed, skipped }: GradeLinkSummary): string {
  const reasons = SKIPPED_LABELS.filter(([key]) => skipped[key] > 0).map(([key, label]) => `${label}: ${skipped[key]}`);
  const parts = [sent === 1 ? '1 e-mail enviado.' : `${sent} e-mails enviados.`];

  if (reasons.length > 0) parts.push(`Alunos que ficaram de fora (${reasons.join(', ')}).`);
  if (failed > 0) {
    const failure = failed === 1 ? '1 e-mail não pôde ser entregue' : `${failed} e-mails não puderam ser entregues`;
    parts.push(`${failure}: confira o endereço. Enviar de novo manda a mensagem outra vez a todos.`);
  }
  return parts.join(' ');
}
