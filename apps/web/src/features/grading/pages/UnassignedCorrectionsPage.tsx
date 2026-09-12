import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, UserCheck } from 'lucide-react'
import { Button, Card, EmptyState, PageHeader, QueryBoundary, SearchIllustration } from '@/components/ui'
import { buildPath, ROUTES } from '@/app/routes'
import { useGradingOverview } from '../hooks/useGrading'

/**
 * The corrections that cannot become a grade yet.
 *
 * A sheet printed without identification is read like any other, but it belongs
 * to nobody until somebody says so — and a grade with no owner is the one thing
 * that cannot be released. Gathering them here is what stops them being
 * discovered at the end.
 */
export function UnassignedCorrectionsPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isPending, isError } = useGradingOverview(id)

  const sheetById = new Map((data?.sheets ?? []).map((sheet) => [sheet.id, sheet]))
  const unassigned = (data?.corrections ?? []).filter(
    (correction) => correction.studentId === undefined,
  )

  return (
    <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Carregando pendências…">
      <div className="flex flex-col gap-6">
        <Link
          to={buildPath(ROUTES.grading, { id: id ?? '' })}
          className="inline-flex w-fit items-center gap-2 text-label text-ink-muted hover:text-primary"
        >
          <ArrowLeft size={16} aria-hidden />
          Folhas
        </Link>

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
                    <Button variant="secondary">
                      <Link
                        to={buildPath(ROUTES.gradingSheet, {
                          id: id ?? '',
                          sheetId: correction.answerSheetId,
                        })}
                      >
                        Associar aluno
                      </Link>
                    </Button>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}
      </div>
    </QueryBoundary>
  )
}
