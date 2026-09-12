import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { PlaceholderPage } from './PlaceholderPage'
import { ROUTES } from './routes'
import {
  ApplicationDetailPage,
  ApplicationFormPage,
  ApplicationGeneratePage,
  ApplicationListPage,
} from '@/features/applications'
import { ClassDetailPage, ClassListPage } from '@/features/classes'
import { DashboardPage, ProfilePage } from '@/features/dashboard'
import { GradingSheetPage, GradingUploadPage, UnassignedCorrectionsPage } from '@/features/grading'
import { PrivacyPage, PublicLookupPage } from '@/features/public'
import { ApplicationReportPage, ConsolidatedReportPage } from '@/features/reports'
import { ExamDetailPage, ExamFormPage, ExamListPage } from '@/features/exams'
import { QuestionFormPage, QuestionListPage } from '@/features/questions'
import { PasswordResetPage, SignInPage, SignUpPage } from '@/features/auth'

/**
 * `basename` comes from the build-time base URL rather than a literal, so the
 * app works at /correctio-app/ on GitHub Pages and at / on Firebase Hosting
 * without a code change. The public lookup path must survive that move: it is
 * printed inside the QR code on paper.
 */
export const router = createBrowserRouter(
  [
    { path: '/', element: <Navigate to={ROUTES.dashboard} replace /> },

    { path: ROUTES.signIn, element: <SignInPage /> },
    { path: ROUTES.signUp, element: <SignUpPage /> },
    { path: ROUTES.passwordReset, element: <PasswordResetPage /> },

    { path: ROUTES.publicLookup, element: <PublicLookupPage /> },
    { path: ROUTES.privacy, element: <PrivacyPage /> },

    {
      element: <AppLayout />,
      children: [
        { path: ROUTES.classes, element: <ClassListPage /> },
        { path: ROUTES.classDetail, element: <ClassDetailPage /> },
        { path: ROUTES.questions, element: <QuestionListPage /> },
        { path: ROUTES.newQuestion, element: <QuestionFormPage /> },
        { path: ROUTES.questionDetail, element: <QuestionFormPage /> },
        { path: ROUTES.exams, element: <ExamListPage /> },
        { path: ROUTES.newExam, element: <ExamFormPage /> },
        { path: ROUTES.generateExam, element: <ExamFormPage /> },
        { path: ROUTES.examDetail, element: <ExamDetailPage /> },
        { path: ROUTES.editExam, element: <ExamFormPage /> },
        { path: ROUTES.applications, element: <ApplicationListPage /> },
        { path: ROUTES.newApplication, element: <ApplicationFormPage /> },
        { path: ROUTES.applicationPdf, element: <ApplicationGeneratePage /> },
        { path: ROUTES.applicationDetail, element: <ApplicationDetailPage /> },
        { path: ROUTES.dashboard, element: <DashboardPage /> },
        { path: ROUTES.profile, element: <ProfilePage /> },
        { path: ROUTES.grading, element: <GradingUploadPage /> },
        { path: ROUTES.gradingSheet, element: <GradingSheetPage /> },
        { path: ROUTES.unassignedCorrections, element: <UnassignedCorrectionsPage /> },
        { path: ROUTES.applicationReport, element: <ApplicationReportPage /> },
        { path: ROUTES.reports, element: <ConsolidatedReportPage /> },
      ],
    },

    { path: '*', element: <PlaceholderPage screen="Página não encontrada" /> },
  ],
  { basename: import.meta.env.BASE_URL },
)
