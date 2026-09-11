import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, ClipboardCheck, FileText, Plus, Users } from 'lucide-react'
import { Button, Card, QueryBoundary } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { formatShortDate } from '@/lib/utils'
import { useCurrentUser } from '@/features/auth'
import { useClassList } from '@/features/classes'
import { useExamList } from '@/features/exams'
import { useRecentActivity } from '../hooks/useDashboard'

/**
 * Applications and pending corrections have no repository yet: their screens
 * are still placeholders (see app/router.tsx). Zero is the honest count of
 * what is actually stored today, not a stand-in value — the cards stay real
 * and clickable, the same way the sidebar links to screens still under
 * construction.
 */
const UNBUILT_SUMMARY_VALUE = 0

export function DashboardPage() {
  const navigate = useNavigate()
  const { data: currentUser } = useCurrentUser()
  const { data: classPage, isPending: classesPending } = useClassList(false, '')
  const { data: examPage, isPending: examsPending } = useExamList(false, '')
  const activity = useRecentActivity()

  const firstName = currentUser?.fullName.split(' ')[0]

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[var(--radius-card)] bg-primary px-6 py-6 text-on-primary sm:px-8 sm:py-8">
        <h1 className="font-[family-name:var(--font-heading)] text-headline">
          {firstName ? `Olá, ${firstName}!` : 'Olá!'}
        </h1>
        <p className="mt-1 text-body text-on-primary/80">
          Aqui está um resumo do que está acontecendo nas suas turmas e provas.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <li>
          <SummaryCard
            to={ROUTES.classes}
            icon={<Users size={22} aria-hidden />}
            label="Turmas ativas"
            value={classesPending ? '—' : (classPage?.total ?? 0)}
          />
        </li>
        <li>
          <SummaryCard
            to={ROUTES.exams}
            icon={<FileText size={22} aria-hidden />}
            label="Provas"
            value={examsPending ? '—' : (examPage?.total ?? 0)}
          />
        </li>
        <li>
          <SummaryCard
            to={ROUTES.applications}
            icon={<ClipboardCheck size={22} aria-hidden />}
            label="Aplicações"
            value={UNBUILT_SUMMARY_VALUE}
          />
        </li>
        <li>
          <SummaryCard
            to={ROUTES.applications}
            icon={<AlertCircle size={22} aria-hidden />}
            label="Correções pendentes"
            value={UNBUILT_SUMMARY_VALUE}
          />
        </li>
      </ul>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary"
          icon={<Plus size={18} aria-hidden />}
          onClick={() => void navigate(ROUTES.classes)}
        >
          Nova turma
        </Button>
        <Button
          variant="secondary"
          icon={<Plus size={18} aria-hidden />}
          onClick={() => void navigate(ROUTES.newExam)}
        >
          Nova prova
        </Button>
        <Button
          variant="secondary"
          icon={<Plus size={18} aria-hidden />}
          onClick={() => void navigate(ROUTES.newApplication)}
        >
          Nova aplicação
        </Button>
        <Button
          variant="secondary"
          icon={<ClipboardCheck size={18} aria-hidden />}
          onClick={() => void navigate(ROUTES.applications)}
        >
          Corrigir provas
        </Button>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-title text-primary">Atividade recente</h2>
        <QueryBoundary
          isPending={activity.isPending}
          isError={activity.isError}
          pendingLabel="Carregando atividade recente…"
        >
          {activity.data?.length ? (
            <Card>
              <ul className="divide-y divide-line">
                {activity.data.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <span className="text-body text-ink">{entry.description}</span>
                    <span className="shrink-0 text-caption text-ink-subtle">
                      {formatShortDate(entry.occurredAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <Card className="p-6">
              <p className="text-body text-ink-muted">Nenhuma atividade registrada ainda.</p>
            </Card>
          )}
        </QueryBoundary>
      </section>
    </div>
  )
}

function SummaryCard({
  to,
  icon,
  label,
  value,
}: Readonly<{
  to: string
  icon: ReactNode
  label: string
  value: number | string
}>) {
  return (
    <Link to={to} className="block">
      <Card interactive className="flex items-center gap-4 p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-primary-container text-on-primary">
          {icon}
        </span>
        <div>
          <p className="text-display text-primary">{value}</p>
          <p className="text-label text-ink-muted">{label}</p>
        </div>
      </Card>
    </Link>
  )
}
