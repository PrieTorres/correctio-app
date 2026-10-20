import { Link } from 'react-router-dom'
import { ClipboardList, FileText, GraduationCap, Library } from 'lucide-react'
import {
  ApplicationsIllustration,
  Card,
  EmptyState,
  PageHeader,
  QueryBoundary,
  Tour,
} from '@/components/ui'
import { buildPath, ROUTES } from '@/app/routes'
import { formatDate } from '@/lib/utils'
import { GradingShortcut } from '../components/GradingShortcut'
import { EMPTY_SUMMARY, useDashboardSummary, type DashboardSummary, type RecentActivity } from '../hooks/useDashboard'

/**
 * Every main action within three clicks of here, which is what RNF06 asks.
 *
 * The quick actions sit beside the summary rather than under it: the counts are
 * what a teacher reads, and the actions are what they came to do, so putting
 * the actions below the fold would cost the click the requirement is about.
 */
const QUICK_ACTIONS = [
  { to: ROUTES.newQuestion, label: 'Nova questão', Icon: Library },
  { to: ROUTES.newExam, label: 'Nova prova', Icon: FileText },
  { to: ROUTES.newApplication, label: 'Nova aplicação', Icon: ClipboardList },
  { to: ROUTES.classes, label: 'Minhas turmas', Icon: GraduationCap },
] as const

export function DashboardPage() {
  const { data, isPending, isError } = useDashboardSummary()
  const summary = data ?? EMPTY_SUMMARY

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        help
        title="Painel"
        description="O resumo do semestre e o caminho mais curto para o que você veio fazer."
      />

      <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando o painel…">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <SummaryCards summary={summary} />
            <RecentActivityCard recent={summary.recent} />
          </div>
          <QuickActions gradable={summary.gradable} />
        </div>
      </QueryBoundary>

      <Tour screen="dashboard" ready={summary.classes > 0} />
    </div>
  )
}

function SummaryCards({ summary }: Readonly<{ summary: DashboardSummary }>) {
  return (
    <div data-tour="summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard label="Turmas" value={summary.classes} to={ROUTES.classes} />
      <SummaryCard label="Questões" value={summary.questions} to={ROUTES.questions} />
      <SummaryCard label="Provas" value={summary.exams} to={ROUTES.exams} />
      <SummaryCard label="Aplicações" value={summary.applications} to={ROUTES.applications} />
    </div>
  )
}

function RecentActivityCard({ recent }: Readonly<{ recent: readonly RecentActivity[] }>) {
  return (
    <Card data-tour="recent">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-title text-primary">Atividade recente</h2>
      </div>
      {recent.length === 0 ? (
        <EmptyState
          illustration={<ApplicationsIllustration />}
          title="Nada aconteceu ainda"
          description="Quando você aplicar uma prova a uma turma, as últimas aplicações aparecem aqui."
        />
      ) : (
        <ul className="divide-y divide-line">
          {recent.map((activity) => (
            <li key={activity.id}>
              <Link
                to={buildPath(ROUTES.applicationDetail, { id: activity.id })}
                className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-surface-muted"
              >
                <span className="min-w-0">
                  <span className="block truncate text-body text-ink">{activity.title}</span>
                  <span className="block text-caption text-ink-subtle">{activity.detail}</span>
                </span>
                <span className="shrink-0 text-caption text-ink-subtle">{formatDate(activity.date)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function QuickActions({ gradable }: Readonly<{ gradable: readonly RecentActivity[] }>) {
  return (
    <Card data-tour="quick-actions" className="flex h-fit flex-col gap-2 p-5">
      <h2 className="text-title text-primary">Ações rápidas</h2>
      <p className="mb-2 text-caption text-ink-subtle">Tudo que você faz com frequência, a um clique.</p>
      {QUICK_ACTIONS.map(({ to, label, Icon }) => (
        <Link
          key={to}
          to={to}
          className="touch-target flex items-center gap-3 rounded-[var(--radius-control)] border border-line px-3 text-body text-ink hover:border-primary hover:bg-surface-muted"
        >
          <Icon size={18} aria-hidden className="text-primary" />
          {label}
        </Link>
      ))}
      <GradingShortcut gradable={gradable} />
    </Card>
  )
}

function SummaryCard({
  label,
  value,
  to,
}: Readonly<{ label: string; value: number; to: string }>) {
  return (
    <Link to={to} className="block">
      <Card interactive className="flex flex-col gap-1 p-5">
        <span className="text-label text-ink-muted">{label}</span>
        <span className="text-display text-primary">{value}</span>
      </Card>
    </Link>
  )
}
