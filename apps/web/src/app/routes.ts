/**
 * Route paths in one place.
 *
 * Screens never hardcode a URL string: a typo in a `<Link>` is invisible until
 * someone clicks it, and the public lookup path in particular is printed onto
 * paper inside a QR code and can never change.
 */
export const ROUTES = {
  dashboard: '/painel',
  profile: '/perfil',

  signIn: '/entrar',
  signUp: '/criar-conta',
  passwordReset: '/recuperar-senha',

  publicLookup: '/r/:code',
  privacy: '/privacidade',

  classes: '/turmas',
  classDetail: '/turmas/:id',

  questions: '/questoes',
  newQuestion: '/questoes/nova',
  questionDetail: '/questoes/:id',

  exams: '/provas',
  newExam: '/provas/nova',
  generateExam: '/provas/gerar',
  examDetail: '/provas/:id',
  editExam: '/provas/:id/editar',

  applications: '/aplicacoes',
  newApplication: '/aplicacoes/nova',
  applicationDetail: '/aplicacoes/:id',
  applicationPdf: '/aplicacoes/:id/pdf',
  grading: '/aplicacoes/:id/corrigir',
  gradingSheet: '/aplicacoes/:id/corrigir/:sheetId',
  unassignedCorrections: '/aplicacoes/:id/pendentes',
  applicationReport: '/aplicacoes/:id/relatorio',

  reports: '/relatorios',
} as const

/** Fills the `:param` placeholders of a route template. */
export function buildPath(
  template: string,
  params: Record<string, string | number>,
): string {
  return Object.entries(params).reduce<string>(
    (path, [key, value]) => path.replace(`:${key}`, String(value)),
    template,
  )
}
