import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { PlaceholderPage } from './PlaceholderPage'
import { ROUTES } from './routes'
import { ClassDetailPage, ClassListPage } from '@/features/classes'

const placeholder = (path: string, screen: string): RouteObject => ({
  path,
  element: <PlaceholderPage screen={screen} />,
})

/** Screens still to be built; each becomes a real element as its step lands. */
const TEACHER_PLACEHOLDERS: RouteObject[] = [
  placeholder(ROUTES.dashboard, 'P1. Painel'),
  placeholder(ROUTES.profile, 'P2. Meu perfil'),
  placeholder(ROUTES.questions, 'P6. Banco de questões'),
  placeholder(ROUTES.newQuestion, 'P7. Questão — criar'),
  placeholder(ROUTES.questionDetail, 'P7. Questão — editar'),
  placeholder(ROUTES.exams, 'P8. Provas'),
  placeholder(ROUTES.newExam, 'P9. Prova — criar'),
  placeholder(ROUTES.generateExam, 'P9b. Gerar automaticamente'),
  placeholder(ROUTES.examDetail, 'P10. Prova — detalhe'),
  placeholder(ROUTES.editExam, 'P9. Prova — editar'),
  placeholder(ROUTES.applications, 'P11. Aplicações'),
  placeholder(ROUTES.newApplication, 'P12. Aplicação — criar'),
  placeholder(ROUTES.applicationDetail, 'P14. Aplicação — detalhe'),
  placeholder(ROUTES.applicationPdf, 'P13. Gerar PDF'),
  placeholder(ROUTES.grading, 'P15. Enviar folhas de respostas'),
  placeholder(ROUTES.gradingSheet, 'P16. Revisar e confirmar'),
  placeholder(ROUTES.unassignedCorrections, 'P17. Pendentes de atribuição'),
  placeholder(ROUTES.applicationReport, 'P18. Relatório da aplicação'),
  placeholder(ROUTES.reports, 'P19. Relatório consolidado'),
]

/**
 * `basename` comes from the build-time base URL rather than a literal, so the
 * app works at /correctio-app/ on GitHub Pages and at / on Firebase Hosting
 * without a code change. The public lookup path must survive that move: it is
 * printed inside the QR code on paper.
 */
export const router = createBrowserRouter(
  [
    { path: '/', element: <Navigate to={ROUTES.dashboard} replace /> },

    placeholder(ROUTES.signIn, 'C1. Login'),
    placeholder(ROUTES.signUp, 'C2. Cadastro'),
    placeholder(ROUTES.passwordReset, 'C3. Recuperar senha'),
    placeholder(ROUTES.publicLookup, 'PUB1. Consulta por QR Code'),
    placeholder(ROUTES.privacy, 'PUB2. Aviso de privacidade'),

    {
      element: <AppLayout />,
      children: [
        { path: ROUTES.classes, element: <ClassListPage /> },
        { path: ROUTES.classDetail, element: <ClassDetailPage /> },
        ...TEACHER_PLACEHOLDERS,
      ],
    },

    { path: '*', element: <PlaceholderPage screen="Página não encontrada" /> },
  ],
  { basename: import.meta.env.BASE_URL },
)
