import { ROUTES } from '@/app/routes'

/**
 * The URL parameters that choose the exam or the class of a new application
 * in advance (#202): the exam's detail (P10) sends the exam, the class (P5)
 * sends the class, so the teacher does not pick again what they came from.
 */
export const SITTING_PARAMS = Object.freeze({ EXAM: 'prova', CLASS: 'turma' } as const)

/** P12, with the exam or the class already chosen when given. */
export function newApplicationPath({ examId, classId }: { examId?: string; classId?: string } = {}): string {
  const query = new URLSearchParams()
  if (examId !== undefined) query.set(SITTING_PARAMS.EXAM, examId)
  if (classId !== undefined) query.set(SITTING_PARAMS.CLASS, classId)
  const search = query.toString()
  return search === '' ? ROUTES.newApplication : `${ROUTES.newApplication}?${search}`
}

/** The option the link named, if it is still among the choices; else the only choice there is; else none. */
function pick(options: readonly { id: string }[], wanted: string | null): string {
  if (wanted !== null && options.some((option) => option.id === wanted)) return wanted
  const [only, ...others] = options
  return only !== undefined && others.length === 0 ? only.id : ''
}

/**
 * The exam and the class P12 opens with. A link to an exam since archived
 * falls back as if it named nothing, and the server would refuse it anyway.
 */
export function initialSittingOf(
  choices: { exams: readonly { id: string }[]; classes: readonly { id: string }[] },
  params: URLSearchParams,
): { examId: string; classId: string } {
  return {
    examId: pick(choices.exams, params.get(SITTING_PARAMS.EXAM)),
    classId: pick(choices.classes, params.get(SITTING_PARAMS.CLASS)),
  }
}
