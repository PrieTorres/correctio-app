import type { ImportResult } from '@/lib/repositories/student-repository'

export interface ImportSummary {
  created: string
  /** Absent when nothing was skipped: a "0 ignorados" line only makes the teacher look for a problem. */
  skipped?: string
}

/** "1 aluno" or "38 alunos": the preview, its button and the result all count students the same way. */
export function studentCount(count: number): string {
  return count === 1 ? '1 aluno' : `${count} alunos`
}

/** The heading of the preview, saying how many pasted lines are ready to go. */
export function describeReady(count: number): string {
  return `${studentCount(count)} ${count === 1 ? 'pronto' : 'prontos'} para importar`
}

/**
 * What an import did, in the teacher's words. The API skips a registration
 * that is already in the class instead of refusing the list, so the skipped
 * line is the only place the teacher learns that some students did not come in.
 */
export function describeImport({ created, skipped }: ImportResult): ImportSummary {
  return {
    created: describeCreated(created),
    ...(skipped > 0 && { skipped: describeSkipped(skipped) }),
  }
}

function describeCreated(count: number): string {
  if (count === 0) return 'Nenhum aluno novo entrou na turma.'
  return `${studentCount(count)} ${count === 1 ? 'entrou' : 'entraram'} na turma.`
}

function describeSkipped(count: number): string {
  return count === 1
    ? '1 foi ignorado porque a matrícula já estava na turma.'
    : `${count} foram ignorados porque a matrícula já estava na turma.`
}
