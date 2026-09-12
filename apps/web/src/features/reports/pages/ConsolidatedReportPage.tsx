import { Link } from 'react-router-dom'
import { Badge, Card, EmptyState, PageHeader, QueryBoundary, SearchIllustration } from '@/components/ui'
import { buildPath, ROUTES } from '@/app/routes'
import { formatDate } from '@/lib/utils'
import { summarise } from '@/lib/reports'
import { useConsolidatedReport } from '../hooks/useConsolidatedReport'

/**
 * Every application side by side, so a term can be read at a glance.
 *
 * Only what the per-application report already computes, gathered: a teacher
 * looking here is comparing, not investigating, and a second place that
 * calculates the same numbers differently is a second place to be wrong.
 */
export function ConsolidatedReportPage() {
  const { data, isPending, isError } = useConsolidatedReport()

  const rows = data ?? []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Relatório consolidado"
        description="As aplicações do semestre lado a lado, da mais recente para a mais antiga."
      />

      <QueryBoundary isPending={isPending} isError={isError} pendingLabel="Reunindo as aplicações…">
        {rows.length === 0 ? (
          <Card>
            <EmptyState
              illustration={<SearchIllustration />}
              title="Nenhuma aplicação corrigida"
              description="Assim que a primeira folha de qualquer aplicação for corrigida, ela entra nesta comparação."
            />
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-body">
                <caption className="sr-only">Comparação das aplicações corrigidas</caption>
                <thead className="text-label text-ink-muted">
                  <tr className="border-b border-line">
                    <th scope="col" className="px-5 py-3 text-left">Prova</th>
                    <th scope="col" className="px-5 py-3 text-left">Turma</th>
                    <th scope="col" className="px-5 py-3 text-left">Data</th>
                    <th scope="col" className="px-5 py-3 text-right">Corrigidas</th>
                    <th scope="col" className="px-5 py-3 text-right">Média</th>
                    <th scope="col" className="px-5 py-3 text-right">Menor</th>
                    <th scope="col" className="px-5 py-3 text-right">Maior</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((row) => {
                    const summary = summarise(row.scores)

                    return (
                      <tr key={row.applicationId}>
                        <td className="px-5 py-3">
                          <Link
                            to={buildPath(ROUTES.applicationReport, { id: row.applicationId })}
                            className="text-primary hover:underline"
                          >
                            {row.examTitle}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-ink-muted">{row.className}</td>
                        <td className="px-5 py-3 text-ink-muted">{formatDate(row.date)}</td>
                        <td className="px-5 py-3 text-right text-ink">{summary.count}</td>
                        <td className="px-5 py-3 text-right">
                          <Badge tone={summary.mean >= 6 ? 'success' : 'warning'}>
                            {summary.mean}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right text-ink-muted">{summary.lowest}</td>
                        <td className="px-5 py-3 text-right text-ink-muted">{summary.highest}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </QueryBoundary>
    </div>
  )
}
