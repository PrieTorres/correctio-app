import { useParams } from 'react-router-dom'
import { UserCheck } from 'lucide-react'
import { BackLink, ButtonLink, Card, EmptyState, PageHeader, QueryBoundary, SearchIllustration, Tour } from '@/components/ui'
import { buildPath, ROUTES } from '@/app/routes'
import { useGradingOverview, useUnassignedCorrections } from '../hooks/useGrading'

/**
 * The corrections that cannot become a grade yet.
 *
 * A sheet printed without identification is read like any other, but it belongs
 * to nobody until somebody says so — and a grade with no owner is the one thing
 * that cannot be released. Gathering them here is what stops them being
 * discovered at the end. The server filters them (`assigned=false`, #48); the
 * sheets only give each one its printed number.
 */
export function UnassignedCorrectionsPage() {
  const { id } = useParams<{ id: string }>()
  const overview = useGradingOverview(id)
  const pending = useUnassignedCorrections(id)

  const sheetById = new Map((overview.data?.sheets ?? []).map((sheet) => [sheet.id, sheet]))
  const unassigned = pending.data ?? []

  return (
    <QueryBoundary
      isPending={overview.isPending || pending.isPending}
      isError={overview.isError || pending.isError}
      pendingLabel="Carregando pendências…"
    >
      <div className="flex flex-col gap-6">
        <BackLink to={buildPath(ROUTES.grading, { id: id ?? '' })}>Folhas</BackLink>

        <PageHeader help
          title="Pendentes de atribuição"
          description="Folhas lidas que ainda não têm dono. Sem aluno associado, a nota não pode ser liberada."
        />

        {unassigned.length === 0 ? (
          <Card>
            <EmptyState
              illustration={<SearchIllustration />}
              title="Nenhuma pendência"
              description="Todas as folhas lidas já estão associadas a um aluno. Provas impressas com identificação caem aqui apenas se a leitura não reconhecer o nome."
            />
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {unassigned.map((correction) => {
                const sheet = sheetById.get(correction.answerSheetId)

                return (
                  <li key={correction.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <UserCheck size={18} aria-hidden className="text-ink-subtle" />
                    <span className="min-w-0 flex-1 text-body text-ink">
                      Folha {sheet?.sheetNumber ?? '—'}
                      <span className="ml-2 text-caption text-ink-subtle">
                        nota {correction.totalScore}
                      </span>
                    </span>
                    <ButtonLink
                      to={buildPath(ROUTES.gradingSheet, { id: id ?? '', sheetId: correction.answerSheetId })}
                      aria-label={`Associar aluno à folha ${sheet?.sheetNumber ?? '—'}`}
                    >
                      Associar aluno
                    </ButtonLink>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}

        <Tour screen="unassignedCorrections" ready={unassigned.length > 0} />
      </div>
    </QueryBoundary>
  )
}
